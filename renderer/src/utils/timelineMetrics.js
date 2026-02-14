export const TIMELINE_WIDTH = 900;
export const TIMELINE_PADDING = 12;

export const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export const mapTimeToX = (time, view) => {
  const duration = view.end - view.start || 1;
  return ((time - view.start) / duration) * (TIMELINE_WIDTH - 2 * TIMELINE_PADDING) + TIMELINE_PADDING;
};

export const mapXToTime = (x, view) => {
  const duration = view.end - view.start || 1;
  return view.start + ((x - TIMELINE_PADDING) / (TIMELINE_WIDTH - 2 * TIMELINE_PADDING)) * duration;
};

export const secondsToTimecodeParts = (seconds, fps) => {
  const safeFps = Math.max(Number(fps) || 30, 1);
  const totalFrames = Math.max(0, Math.round(seconds * safeFps));
  const frames = totalFrames % safeFps;
  const totalSeconds = Math.floor(totalFrames / safeFps);
  const secs = totalSeconds % 60;
  const mins = Math.floor(totalSeconds / 60);
  return { minutes: mins, seconds: secs, frames };
};

export const formatTimecode = (seconds, fps) => {
  const { minutes, seconds: secs, frames } = secondsToTimecodeParts(seconds, fps);
  const pad = (value, length = 2) => String(value).padStart(length, '0');
  return `${pad(minutes)}:${pad(secs)}:${pad(frames)}`;
};

export const timecodePartsToSeconds = (minutes, seconds, frames, fps) => {
  const safeFps = Math.max(Number(fps) || 30, 1);
  const mins = Math.max(Number(minutes) || 0, 0);
  const secs = clamp(Number(seconds) || 0, 0, 59);
  const fr = clamp(Number(frames) || 0, 0, safeFps - 1);
  return mins * 60 + secs + fr / safeFps;
};
