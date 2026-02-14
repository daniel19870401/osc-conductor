const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('oscDaw', {
  getVersion: () => ipcRenderer.invoke('app:get-version'),
  getAudioOutputChannels: () => ipcRenderer.invoke('audio:get-output-channels'),
  getNativeAudioStatus: () => ipcRenderer.invoke('audio:native-status'),
  getNativeAudioDevices: () => ipcRenderer.invoke('audio:native-devices'),
  configureNativeAudio: (payload) => ipcRenderer.invoke('audio:native-configure', payload),
  setNativeAudioTracks: (payload) => ipcRenderer.invoke('audio:native-set-tracks', payload),
  updateNativeAudioTrackMix: (payload) => ipcRenderer.invoke('audio:native-update-track-mix', payload),
  playNativeAudio: (payload) => ipcRenderer.invoke('audio:native-play', payload),
  pauseNativeAudio: () => ipcRenderer.invoke('audio:native-pause'),
  seekNativeAudio: (payload) => ipcRenderer.invoke('audio:native-seek', payload),
  cacheNativeAudioFile: (payload) => ipcRenderer.invoke('audio:native-cache-file', payload),
  sendOscMessage: (payload) => ipcRenderer.invoke('osc:send', payload),
  sendArtNetFrame: (payload) => ipcRenderer.invoke('dmx:send-artnet', payload),
  startOscListening: (payload) => ipcRenderer.invoke('osc:listen-start', payload),
  stopOscListening: () => ipcRenderer.invoke('osc:listen-stop'),
  startOscControlListening: (payload) => ipcRenderer.invoke('osc:control-listen-start', payload),
  stopOscControlListening: () => ipcRenderer.invoke('osc:control-listen-stop'),
  setOscRecordingConfig: (payload) => ipcRenderer.invoke('osc:set-recording-config', payload),
  drainOscBuffer: (payload) => ipcRenderer.invoke('osc:drain-buffer', payload),
  sendVirtualMidiMessage: (payload) => ipcRenderer.invoke('midi:virtual-send', payload),
  getVirtualMidiStatus: () => ipcRenderer.invoke('midi:virtual-status'),
  onOscMessage: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('osc:message', listener);
    return () => ipcRenderer.removeListener('osc:message', listener);
  },
  onOscMessageBatch: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('osc:message-batch', listener);
    return () => ipcRenderer.removeListener('osc:message-batch', listener);
  },
  onOscListenStatus: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('osc:listen-status', listener);
    return () => ipcRenderer.removeListener('osc:listen-status', listener);
  },
  onOscControlMessage: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('osc:control-message', listener);
    return () => ipcRenderer.removeListener('osc:control-message', listener);
  },
  onVirtualMidiMessage: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('midi:virtual-message', listener);
    return () => ipcRenderer.removeListener('midi:virtual-message', listener);
  },
  onVirtualMidiStatus: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('midi:virtual-status', listener);
    return () => ipcRenderer.removeListener('midi:virtual-status', listener);
  },
});
