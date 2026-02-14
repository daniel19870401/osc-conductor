const { parentPort } = require('worker_threads');
const dgram = require('dgram');

if (!parentPort) {
  process.exit(0);
}

const OSC_RECORD_QUEUE_MAX_ITEMS = 50000000;
const OSC_PREVIEW_QUEUE_MAX_ITEMS = 65536;
const OSC_DRAIN_CHUNK_SIZE = 8192;

let recordQueue = [];
let recordReadIndex = 0;
let droppedRecordCount = 0;
const previewQueueByAddress = new Map();
const latestByAddress = new Map();

const recordState = {
  armed: false,
  playing: false,
  fps: 30,
  startWallMs: 0,
  startPlayhead: 0,
  projectLength: 120,
  lastFrameIndex: -1,
};

let recordTimer = null;
let listenSocket = null;
let listenPort = null;

const emitListenStatus = (status, extra = {}) => {
  parentPort.postMessage({
    type: 'listen-status',
    payload: {
      status,
      port: listenPort,
      timestamp: Date.now(),
      ...extra,
    },
  });
};

const currentRecordSize = () => Math.max(recordQueue.length - recordReadIndex, 0);

const compactRecordQueue = () => {
  if (recordReadIndex <= 65536) return;
  if (recordReadIndex * 2 <= recordQueue.length) return;
  recordQueue = recordQueue.slice(recordReadIndex);
  recordReadIndex = 0;
};

const enqueueRecord = (payload) => {
  recordQueue.push(payload);
  const overflow = currentRecordSize() - OSC_RECORD_QUEUE_MAX_ITEMS;
  if (overflow > 0) {
    recordReadIndex += overflow;
    droppedRecordCount += overflow;
  }
  compactRecordQueue();
};

const enqueuePreview = (payload) => {
  const address = typeof payload?.address === 'string' ? payload.address : '';
  if (!address) return;
  previewQueueByAddress.set(address, payload);
  if (previewQueueByAddress.size <= OSC_PREVIEW_QUEUE_MAX_ITEMS) return;
  const oldestAddress = previewQueueByAddress.keys().next().value;
  if (typeof oldestAddress === 'string' && oldestAddress) {
    previewQueueByAddress.delete(oldestAddress);
  }
};

const getRuntime = (nowMs) => {
  const fps = Math.max(Number(recordState.fps) || 30, 1);
  const elapsedSeconds = Math.max((nowMs - (Number(recordState.startWallMs) || nowMs)) / 1000, 0);
  const rawTime = (Number(recordState.startPlayhead) || 0) + elapsedSeconds;
  const projectLength = Math.max(Number(recordState.projectLength) || 0, 0);
  const clamped = Math.max(0, Math.min(rawTime, projectLength));
  const frameStep = 1 / fps;
  const frameIndex = Math.max(Math.floor(clamped / frameStep + 1e-9), 0);
  return {
    fps,
    frameStep,
    frameIndex,
    projectLength,
  };
};

const stopRecordTimer = () => {
  if (!recordTimer) return;
  clearInterval(recordTimer);
  recordTimer = null;
};

const emitRecordFrames = () => {
  if (!recordState.armed || !recordState.playing) return;
  if (!latestByAddress.size) return;

  const nowMs = Date.now();
  const { frameStep, frameIndex, projectLength } = getRuntime(nowMs);
  let nextFrameIndex = Number.isInteger(recordState.lastFrameIndex)
    ? recordState.lastFrameIndex + 1
    : frameIndex;

  if (nextFrameIndex > frameIndex) return;

  for (let index = nextFrameIndex; index <= frameIndex; index += 1) {
    const time = Math.max(0, Math.min(index * frameStep, projectLength));
    latestByAddress.forEach((latest, address) => {
      const value = Number(latest?.value);
      const firstFrameIndex = Number.isInteger(latest?.firstFrameIndex) ? latest.firstFrameIndex : 0;
      if (!Number.isFinite(value)) return;
      if (typeof address !== 'string' || !address) return;
      if (index < firstFrameIndex) return;
      enqueueRecord({
        address,
        value,
        time,
        record: true,
        timestamp: nowMs,
      });
    });
  }

  recordState.lastFrameIndex = frameIndex;
};

const restartRecordTimer = () => {
  stopRecordTimer();
  if (!recordState.armed || !recordState.playing) {
    recordState.lastFrameIndex = -1;
    return;
  }
  const { fps, frameIndex } = getRuntime(Date.now());
  latestByAddress.forEach((latest, address) => {
    if (typeof address !== 'string' || !address) return;
    const value = Number(latest?.value);
    if (!Number.isFinite(value)) return;
    latestByAddress.set(address, {
      value,
      firstFrameIndex: frameIndex,
    });
  });
  recordState.lastFrameIndex = frameIndex - 1;
  emitRecordFrames();
  const tickMs = Math.max(1000 / (fps * 2), 2);
  recordTimer = setInterval(emitRecordFrames, tickMs);
};

const readOscString = (buffer, offset) => {
  if (offset >= buffer.length) return null;
  let end = offset;
  while (end < buffer.length && buffer[end] !== 0) {
    end += 1;
  }
  if (end >= buffer.length) return null;
  const value = buffer.toString('utf8', offset, end);
  let nextOffset = end + 1;
  while (nextOffset % 4 !== 0) {
    nextOffset += 1;
  }
  if (nextOffset > buffer.length) return null;
  return { value, nextOffset };
};

const readOscArgument = (buffer, offset, typeTag) => {
  if (typeTag === 'i') {
    if (offset + 4 > buffer.length) return null;
    return { value: buffer.readInt32BE(offset), nextOffset: offset + 4 };
  }
  if (typeTag === 'f') {
    if (offset + 4 > buffer.length) return null;
    return { value: buffer.readFloatBE(offset), nextOffset: offset + 4 };
  }
  if (typeTag === 'd') {
    if (offset + 8 > buffer.length) return null;
    return { value: buffer.readDoubleBE(offset), nextOffset: offset + 8 };
  }
  if (typeTag === 'h') {
    if (offset + 8 > buffer.length) return null;
    return { value: Number(buffer.readBigInt64BE(offset)), nextOffset: offset + 8 };
  }
  if (typeTag === 's') {
    const parsed = readOscString(buffer, offset);
    if (!parsed) return null;
    return { value: parsed.value, nextOffset: parsed.nextOffset };
  }
  if (typeTag === 'T') return { value: true, nextOffset: offset };
  if (typeTag === 'F') return { value: false, nextOffset: offset };
  if (typeTag === 'N' || typeTag === 'I') return { value: null, nextOffset: offset };
  return null;
};

const decodeOscPacket = (buffer) => {
  const parsedAddress = readOscString(buffer, 0);
  if (!parsedAddress) return [];
  const address = parsedAddress.value;

  if (address === '#bundle') {
    let offset = parsedAddress.nextOffset + 8;
    if (offset > buffer.length) return [];
    const messages = [];
    while (offset + 4 <= buffer.length) {
      const elementSize = buffer.readInt32BE(offset);
      offset += 4;
      if (elementSize <= 0 || offset + elementSize > buffer.length) break;
      const element = buffer.subarray(offset, offset + elementSize);
      messages.push(...decodeOscPacket(element));
      offset += elementSize;
    }
    return messages;
  }

  const parsedTypeTags = readOscString(buffer, parsedAddress.nextOffset);
  if (!parsedTypeTags) return [{ address, args: [] }];
  const tags = parsedTypeTags.value.startsWith(',') ? parsedTypeTags.value.slice(1) : '';
  let offset = parsedTypeTags.nextOffset;
  const args = [];

  for (let i = 0; i < tags.length; i += 1) {
    const parsedArg = readOscArgument(buffer, offset, tags[i]);
    if (!parsedArg) break;
    args.push(parsedArg.value);
    offset = parsedArg.nextOffset;
  }

  return [{ address, args }];
};

const pushOsc = (payload) => {
  const address = typeof payload?.address === 'string' ? payload.address : '';
  const value = Number(payload?.value);
  if (!address || !Number.isFinite(value)) return;

  const nowMs = Date.now();
  const runtime = getRuntime(nowMs);
  const firstFrameIndex = Number.isInteger(runtime.frameIndex) ? runtime.frameIndex : 0;
  const previous = latestByAddress.get(address);
  if (previous && typeof previous === 'object') {
    latestByAddress.set(address, {
      value,
      firstFrameIndex: Number.isInteger(previous.firstFrameIndex)
        ? previous.firstFrameIndex
        : firstFrameIndex,
    });
  } else {
    latestByAddress.set(address, {
      value,
      firstFrameIndex,
    });
  }

  if (recordState.armed && recordState.playing) return;

  enqueuePreview({
    address,
    value,
    args: Array.isArray(payload?.args) ? payload.args : [],
    host: payload?.host,
    sourcePort: payload?.sourcePort,
    listenPort: payload?.listenPort,
    record: false,
    timestamp: Number(payload?.timestamp) || nowMs,
  });
};

const stopListener = () => new Promise((resolve) => {
  if (!listenSocket) {
    latestByAddress.clear();
    recordState.lastFrameIndex = -1;
    listenPort = null;
    emitListenStatus('stopped');
    resolve({ ok: true, port: null });
    return;
  }
  const socket = listenSocket;
  listenSocket = null;
  try {
    socket.removeAllListeners();
    socket.close(() => {
      latestByAddress.clear();
      recordState.lastFrameIndex = -1;
      listenPort = null;
      emitListenStatus('stopped');
      resolve({ ok: true, port: null });
    });
  } catch (error) {
    latestByAddress.clear();
    recordState.lastFrameIndex = -1;
    listenPort = null;
    emitListenStatus('stopped');
    resolve({ ok: true, port: null });
  }
});

const startListener = (portValue) => new Promise((resolve) => {
  const parsedPort = Number(portValue);
  const safePort = Number.isFinite(parsedPort) ? Math.min(Math.max(Math.round(parsedPort), 1), 65535) : 9001;

  if (listenSocket && listenPort === safePort) {
    emitListenStatus('listening', { port: safePort });
    resolve({ ok: true, port: safePort });
    return;
  }

  stopListener().then(() => {
    const socket = dgram.createSocket('udp4');
    listenSocket = socket;
    let settled = false;

    socket.on('message', (msg, rinfo) => {
      const packets = decodeOscPacket(msg);
      packets.forEach((packet) => {
        const value = packet.args.find((arg) => Number.isFinite(arg));
        if (!Number.isFinite(value)) return;
        pushOsc({
          address: packet.address,
          value,
          args: packet.args,
          host: rinfo.address,
          sourcePort: rinfo.port,
          listenPort: safePort,
          timestamp: Date.now(),
        });
      });
    });

    socket.on('error', (error) => {
      emitListenStatus('error', { port: safePort, error: error?.message || 'listen error' });
      if (!settled) {
        settled = true;
        resolve({ ok: false, port: safePort, error: error?.message || 'listen error' });
      }
      if (listenSocket === socket) {
        listenSocket = null;
        listenPort = null;
      }
    });

    socket.bind(safePort, '0.0.0.0', () => {
      listenPort = safePort;
      emitListenStatus('listening', { port: safePort });
      if (!settled) {
        settled = true;
        resolve({ ok: true, port: safePort });
      }
    });
  });
});

const setRecordingConfig = (payload) => {
  const nextArmed = Boolean(payload?.armed);
  const nextPlaying = Boolean(payload?.playing);
  const nextFps = Math.max(Number(payload?.fps) || recordState.fps || 30, 1);
  const nextStartWall = Number(payload?.startWallMs);
  const nextStartPlayhead = Number(payload?.startPlayhead);
  const nextLength = Math.max(Number(payload?.projectLength) || recordState.projectLength || 0, 0);

  recordState.armed = nextArmed;
  recordState.playing = nextPlaying;
  recordState.fps = nextFps;
  recordState.projectLength = nextLength;
  if (Number.isFinite(nextStartWall) && nextStartWall > 0) {
    recordState.startWallMs = nextStartWall;
  }
  if (Number.isFinite(nextStartPlayhead)) {
    recordState.startPlayhead = Math.max(nextStartPlayhead, 0);
  }

  restartRecordTimer();
  return { ok: true };
};

const drainBuffer = (payload) => {
  const requested = Number(payload?.limit);
  const limit = Number.isFinite(requested)
    ? Math.max(1, Math.min(Math.floor(requested), OSC_DRAIN_CHUNK_SIZE))
    : OSC_DRAIN_CHUNK_SIZE;
  const remainingBefore = currentRecordSize() + previewQueueByAddress.size;
  if (!remainingBefore) {
    return {
      ok: true,
      items: [],
      remaining: 0,
      dropped: droppedRecordCount,
    };
  }

  const items = [];
  const availableRecord = currentRecordSize();
  const recordCount = Math.min(limit, availableRecord);
  if (recordCount > 0) {
    items.push(...recordQueue.slice(recordReadIndex, recordReadIndex + recordCount));
    recordReadIndex += recordCount;
    compactRecordQueue();
  }

  if (items.length < limit && previewQueueByAddress.size) {
    const take = limit - items.length;
    const iterator = previewQueueByAddress.entries();
    for (let i = 0; i < take; i += 1) {
      const next = iterator.next();
      if (next.done) break;
      const [address, preview] = next.value;
      items.push(preview);
      previewQueueByAddress.delete(address);
    }
  }

  return {
    ok: true,
    items,
    remaining: currentRecordSize() + previewQueueByAddress.size,
    dropped: droppedRecordCount,
  };
};

const clearQueues = () => {
  recordQueue = [];
  recordReadIndex = 0;
  droppedRecordCount = 0;
  previewQueueByAddress.clear();
  return { ok: true };
};

const handleRpc = async (id, method, payload) => {
  let result = null;
  if (method === 'set-recording-config') {
    result = setRecordingConfig(payload);
  } else if (method === 'drain-buffer') {
    result = drainBuffer(payload);
  } else if (method === 'start-listener') {
    result = await startListener(payload?.port);
  } else if (method === 'stop-listener') {
    result = await stopListener();
  } else if (method === 'clear-queues') {
    result = clearQueues();
  } else {
    throw new Error(`Unknown recorder RPC method: ${method}`);
  }
  parentPort.postMessage({
    type: 'rpc-result',
    id,
    result,
  });
};

parentPort.on('message', (message) => {
  if (!message || typeof message !== 'object') return;
  if (message.type === 'push-osc') {
    pushOsc(message.payload);
    return;
  }
  if (message.type === 'rpc') {
    handleRpc(message.id, message.method, message.payload).catch((error) => {
      parentPort.postMessage({
        type: 'rpc-result',
        id: message.id,
        error: error?.message || 'Recorder worker RPC failed',
      });
    });
  }
});
