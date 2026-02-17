import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import NodeEditor from './NodeEditor.jsx';
import DmxColorEditor from './DmxColorEditor.jsx';
import OscArrayEditor from './OscArrayEditor.jsx';
import Osc3dEditor from './Osc3dEditor.jsx';
import GroupLane from './GroupLane.jsx';
import { TIMELINE_PADDING } from '../utils/timelineMetrics.js';

const AUDIO_MIN_CLIP_DURATION = 0.01;

const normalizeAudioFadeShape = (value) => {
  const next = typeof value === 'string' ? value.trim().toLowerCase() : 'linear';
  if (
    next === 'linear'
    || next === 'ease-in'
    || next === 'ease-out'
    || next === 'ease-in-out'
    || next === 's-curve'
    || next === 'exp'
    || next === 'log'
  ) {
    return next;
  }
  return 'linear';
};

const resolveAudioTrimRange = (durationRaw, trimInRaw, trimOutRaw) => {
  const duration = Math.max(Number(durationRaw) || 0, 0);
  if (duration <= 0) {
    return { trimIn: 0, trimOut: 0, clipDuration: 0 };
  }
  const trimIn = Math.min(Math.max(Number(trimInRaw) || 0, 0), duration);
  const parsedTrimOut = Number(trimOutRaw);
  const rawTrimOut = Number.isFinite(parsedTrimOut) && parsedTrimOut > 0 ? parsedTrimOut : duration;
  let trimOut = Math.min(Math.max(rawTrimOut, 0), duration);
  if (trimOut <= trimIn) {
    trimOut = Math.min(Math.max(trimIn + AUDIO_MIN_CLIP_DURATION, 0), duration);
  }
  return {
    trimIn,
    trimOut,
    clipDuration: Math.max(trimOut - trimIn, 0),
  };
};

const getAudioCurvePower = (curvatureRaw) => {
  const curvature = Math.min(Math.max(Number(curvatureRaw) || 0, -1), 1);
  if (curvature >= 0) return 1 + curvature * 6;
  return 1 / (1 + Math.abs(curvature) * 6);
};

const evaluateAudioFadeCurve = (progressRaw, shapeRaw = 'linear', curvatureRaw = 0) => {
  const progress = Math.min(Math.max(Number(progressRaw) || 0, 0), 1);
  const shape = normalizeAudioFadeShape(shapeRaw);
  const power = getAudioCurvePower(curvatureRaw);
  switch (shape) {
    case 'ease-in':
      return Math.pow(progress, 2 * power);
    case 'ease-out':
      return 1 - Math.pow(1 - progress, 2 * power);
    case 'ease-in-out':
      if (progress <= 0.5) return 0.5 * Math.pow(progress * 2, 2 * power);
      return 1 - 0.5 * Math.pow((1 - progress) * 2, 2 * power);
    case 's-curve':
      return progress * progress * (3 - 2 * progress);
    case 'exp':
      return Math.pow(progress, power + 0.6);
    case 'log':
      return 1 - Math.pow(1 - progress, power + 0.6);
    case 'linear':
    default:
      return Math.pow(progress, power);
  }
};

function TrackLane({
  track,
  groupMembers = [],
  isGroupedChild = false,
  view,
  height,
  timelineWidth,
  curveFps = 30,
  suspendRendering = false,
  isSelected,
  externalSelectedNodeIds = [],
  onSelect,
  onSelectTrack,
  onNodeDrag,
  onSetNodeCurve,
  onAddNode,
  onEditNode,
  onDeleteNodes,
  onSelectionChange,
  onMoveAudioClip,
  onPatchAudioClip,
  onEditAudioClipStart,
  onEditAudioFade,
  audioWaveform,
  cues = [],
}) {
  const isAudio = track.kind === 'audio';
  const isGroup = track.kind === 'group';
  const isDmxColor = track.kind === 'dmx-color' || track.kind === 'osc-color';
  const isOscArray = track.kind === 'osc-array';
  const isOsc3d = track.kind === 'osc-3d';
  const trackColor = typeof track.color === 'string' ? track.color : '#5dd8c7';
  const laneRef = useRef(null);
  const dragRef = useRef(null);
  const [dragClipStart, setDragClipStart] = useState(null);
  const [dragTrimIn, setDragTrimIn] = useState(null);
  const [dragTrimOut, setDragTrimOut] = useState(null);
  const [dragFadeInDuration, setDragFadeInDuration] = useState(null);
  const [dragFadeOutDuration, setDragFadeOutDuration] = useState(null);
  const [dragFadeInCurvature, setDragFadeInCurvature] = useState(null);
  const [dragFadeOutCurvature, setDragFadeOutCurvature] = useState(null);
  const peaks = Array.isArray(audioWaveform?.peaks)
    ? audioWaveform.peaks
    : (Array.isArray(track.audio?.waveformPeaks) ? track.audio.waveformPeaks : []);
  const duration = Number.isFinite(audioWaveform?.duration) && audioWaveform.duration > 0
    ? audioWaveform.duration
    : (Number.isFinite(track.audio?.waveformDuration) && track.audio.waveformDuration > 0
      ? track.audio.waveformDuration
    : (Number.isFinite(track.audio?.duration) && track.audio.duration > 0
      ? track.audio.duration
      : (Number.isFinite(view.length) && view.length > 0 ? view.length : 1)));
  const clipStart = Number.isFinite(track.audio?.clipStart) ? Math.max(track.audio.clipStart, 0) : 0;
  const trim = resolveAudioTrimRange(duration, track.audio?.trimIn, track.audio?.trimOut);
  const activeClipStart = dragClipStart !== null ? dragClipStart : clipStart;
  const activeTrimIn = dragTrimIn !== null ? dragTrimIn : trim.trimIn;
  const activeTrimOut = dragTrimOut !== null ? dragTrimOut : trim.trimOut;
  const activeClipDuration = Math.max(activeTrimOut - activeTrimIn, 0);
  const clipEnd = activeClipStart + activeClipDuration;
  const fadeInEnabled = Boolean(track.audio?.fadeInEnabled);
  const fadeOutEnabled = Boolean(track.audio?.fadeOutEnabled);
  const fadeInShape = normalizeAudioFadeShape(track.audio?.fadeInShape);
  const fadeOutShape = normalizeAudioFadeShape(track.audio?.fadeOutShape);
  const fadeInCurvature = dragFadeInCurvature !== null
    ? Math.min(Math.max(dragFadeInCurvature, -1), 1)
    : Math.min(Math.max(Number(track.audio?.fadeInCurvature) || 0, -1), 1);
  const fadeOutCurvature = dragFadeOutCurvature !== null
    ? Math.min(Math.max(dragFadeOutCurvature, -1), 1)
    : Math.min(Math.max(Number(track.audio?.fadeOutCurvature) || 0, -1), 1);
  const fadeInDuration = Math.min(
    Math.max(dragFadeInDuration !== null ? dragFadeInDuration : (Number(track.audio?.fadeInDuration) || 0), 0),
    activeClipDuration
  );
  const fadeOutDuration = Math.min(
    Math.max(dragFadeOutDuration !== null ? dragFadeOutDuration : (Number(track.audio?.fadeOutDuration) || 0), 0),
    activeClipDuration
  );
  const hasAudioClip = Boolean(track.audio?.src || track.audio?.name);
  const cueTimes = useMemo(
    () => cues
      .map((cue) => cue?.t)
      .filter((time) => Number.isFinite(time))
      .sort((a, b) => a - b),
    [cues]
  );
  const viewSpan = Math.max(view.end - view.start, 0.001);
  const contentWidth = Math.max(Number(timelineWidth) || 900, TIMELINE_PADDING * 2 + 1);
  const clipVisibleStart = Math.max(activeClipStart, view.start);
  const clipVisibleEnd = Math.min(clipEnd, view.end);
  const clipVisibleDuration = Math.max(clipVisibleEnd - clipVisibleStart, 0);
  const clipHasVisibleRange = clipVisibleDuration > 0;
  const mapTimeToSvgX = (time) => {
    const ratio = (time - view.start) / viewSpan;
    return ratio * (contentWidth - TIMELINE_PADDING * 2) + TIMELINE_PADDING;
  };
  const clipRectX = clipHasVisibleRange ? mapTimeToSvgX(clipVisibleStart) : 0;
  const clipRectWidth = clipHasVisibleRange ? Math.max(mapTimeToSvgX(clipVisibleEnd) - clipRectX, 1) : 0;
  const fullClipVisibleStartX = clipHasVisibleRange ? mapTimeToSvgX(Math.max(activeClipStart, view.start)) : 0;
  const fullClipVisibleEndX = clipHasVisibleRange ? mapTimeToSvgX(Math.min(clipEnd, view.end)) : 0;
  const trimHandleWidth = Math.min(10, Math.max(clipRectWidth * 0.12, 4));
  const fadeInBoundaryTime = activeClipStart + fadeInDuration;
  const fadeOutBoundaryTime = clipEnd - fadeOutDuration;

  const waveformLines = useMemo(() => {
    if (
      suspendRendering
      || !isAudio
      || !clipHasVisibleRange
      || peaks.length < 2
      || duration <= 0
      || activeClipDuration <= 0
    ) return [];
    const lineCount = Math.min(1000, Math.max(Math.floor(clipVisibleDuration * 48), 140));
    return Array.from({ length: lineCount }, (_, index) => {
      const ratio = lineCount <= 1 ? 0 : index / (lineCount - 1);
      const time = clipVisibleStart + ratio * clipVisibleDuration;
      const sourceTime = activeTrimIn + Math.min(Math.max(time - activeClipStart, 0), activeClipDuration);
      const progress = Math.min(Math.max(sourceTime / duration, 0), 1);
      const peakIndex = Math.round(progress * (peaks.length - 1));
      const amplitude = peaks[peakIndex] ?? 0;
      const peak = Math.max(Math.min(amplitude, 1), 0);
      const shaped = Math.sqrt(peak);
      const lineHeight = Math.max(shaped * 76, 2);
      return {
        key: `${index}-${ratio}`,
        x: mapTimeToSvgX(time),
        y: 50 - lineHeight / 2,
        h: lineHeight,
      };
    });
  }, [
    suspendRendering,
    isAudio,
    clipHasVisibleRange,
    peaks,
    duration,
    activeClipDuration,
    activeTrimIn,
    clipVisibleDuration,
    clipVisibleStart,
    activeClipStart,
    contentWidth,
    view.start,
    view.end,
  ]);

  useEffect(() => {
    if (!isAudio) return;
    setDragClipStart(null);
    setDragTrimIn(null);
    setDragTrimOut(null);
    setDragFadeInDuration(null);
    setDragFadeOutDuration(null);
    setDragFadeInCurvature(null);
    setDragFadeOutCurvature(null);
  }, [clipStart, trim.trimIn, trim.trimOut, isAudio]);

  const findNearestCue = (time) => {
    if (!cueTimes.length) return null;
    let nearest = cueTimes[0];
    let minDiff = Math.abs(time - nearest);
    for (let i = 1; i < cueTimes.length; i += 1) {
      const candidate = cueTimes[i];
      const diff = Math.abs(time - candidate);
      if (diff < minDiff) {
        nearest = candidate;
        minDiff = diff;
      }
    }
    return nearest;
  };

  const commitAudioPatch = (patch) => {
    if (!isAudio || !patch || typeof patch !== 'object') return;
    if (!Object.keys(patch).length) return;
    if (typeof onPatchAudioClip === 'function') {
      onPatchAudioClip(track.id, patch);
      return;
    }
    if (typeof patch.clipStart === 'number' && typeof onMoveAudioClip === 'function') {
      onMoveAudioClip(track.id, patch.clipStart);
    }
  };

  const resetAudioDragState = () => {
    setDragClipStart(null);
    setDragTrimIn(null);
    setDragTrimOut(null);
    setDragFadeInDuration(null);
    setDragFadeOutDuration(null);
    setDragFadeInCurvature(null);
    setDragFadeOutCurvature(null);
  };

  const handleClipDoubleClick = (event) => {
    if (!onEditAudioClipStart || !isAudio || !hasAudioClip) return;
    event.preventDefault();
    event.stopPropagation();
    onEditAudioClipStart(track.id, clipStart);
  };

  const startAudioDrag = (mode, event) => {
    if (!isAudio || !hasAudioClip || !clipHasVisibleRange) return;
    if (event.button !== 0) return;
    const svg = event.currentTarget?.ownerSVGElement || laneRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    if (!rect.width) return;
    const clientXToTime = (clientX) => {
      const localX = ((clientX - rect.left) / rect.width) * contentWidth;
      const clampedX = Math.min(
        Math.max(localX, TIMELINE_PADDING),
        contentWidth - TIMELINE_PADDING
      );
      const ratio = (clampedX - TIMELINE_PADDING) / Math.max(contentWidth - TIMELINE_PADDING * 2, 1);
      return view.start + ratio * viewSpan;
    };
    event.preventDefault();
    event.stopPropagation();
    const startPointerTime = clientXToTime(event.clientX);
    const currentFadeInDuration = Math.min(Math.max(Number(track.audio?.fadeInDuration) || 0, 0), trim.clipDuration);
    const currentFadeOutDuration = Math.min(Math.max(Number(track.audio?.fadeOutDuration) || 0, 0), trim.clipDuration);
    dragRef.current = {
      mode,
      startPointerTime,
      startY: event.clientY,
      baseStart: clipStart,
      baseTrimIn: trim.trimIn,
      baseTrimOut: trim.trimOut,
      baseFadeInDuration: currentFadeInDuration,
      baseFadeOutDuration: currentFadeOutDuration,
      baseFadeInCurvature: Math.min(Math.max(Number(track.audio?.fadeInCurvature) || 0, -1), 1),
      baseFadeOutCurvature: Math.min(Math.max(Number(track.audio?.fadeOutCurvature) || 0, -1), 1),
      lastStart: clipStart,
      lastTrimIn: trim.trimIn,
      lastTrimOut: trim.trimOut,
      lastFadeInDuration: currentFadeInDuration,
      lastFadeOutDuration: currentFadeOutDuration,
      lastFadeInCurvature: Math.min(Math.max(Number(track.audio?.fadeInCurvature) || 0, -1), 1),
      lastFadeOutCurvature: Math.min(Math.max(Number(track.audio?.fadeOutCurvature) || 0, -1), 1),
    };
    resetAudioDragState();
    if (mode === 'move') {
      setDragClipStart(clipStart);
    } else if (mode === 'trim-left') {
      setDragClipStart(clipStart);
      setDragTrimIn(trim.trimIn);
    } else if (mode === 'trim-right') {
      setDragTrimOut(trim.trimOut);
    } else if (mode === 'fade-in-duration') {
      setDragFadeInDuration(currentFadeInDuration);
    } else if (mode === 'fade-out-duration') {
      setDragFadeOutDuration(currentFadeOutDuration);
    } else if (mode === 'fade-in-curve') {
      setDragFadeInCurvature(Math.min(Math.max(Number(track.audio?.fadeInCurvature) || 0, -1), 1));
    } else if (mode === 'fade-out-curve') {
      setDragFadeOutCurvature(Math.min(Math.max(Number(track.audio?.fadeOutCurvature) || 0, -1), 1));
    }

    const onPointerMove = (moveEvent) => {
      const current = dragRef.current;
      if (!current) return;
      const pointerTime = clientXToTime(moveEvent.clientX);
      let nextStart = current.baseStart;
      let nextTrimIn = current.baseTrimIn;
      let nextTrimOut = current.baseTrimOut;
      let nextFadeIn = current.baseFadeInDuration;
      let nextFadeOut = current.baseFadeOutDuration;
      let nextFadeInCurve = current.baseFadeInCurvature;
      let nextFadeOutCurve = current.baseFadeOutCurvature;

      if (current.mode === 'move') {
        const deltaTime = pointerTime - current.startPointerTime;
        nextStart = Math.max(current.baseStart + deltaTime, 0);
        if (moveEvent.altKey) {
          const nearestCue = findNearestCue(nextStart);
          if (Number.isFinite(nearestCue)) nextStart = nearestCue;
        }
        setDragClipStart(nextStart);
      } else if (current.mode === 'trim-left') {
        const rightEdge = current.baseStart + Math.max(current.baseTrimOut - current.baseTrimIn, AUDIO_MIN_CLIP_DURATION);
        let candidateStart = Math.min(Math.max(pointerTime, 0), rightEdge - AUDIO_MIN_CLIP_DURATION);
        if (moveEvent.altKey) {
          const nearestCue = findNearestCue(candidateStart);
          if (Number.isFinite(nearestCue)) candidateStart = nearestCue;
        }
        nextTrimIn = Math.min(
          Math.max(current.baseTrimIn + (candidateStart - current.baseStart), 0),
          Math.max(current.baseTrimOut - AUDIO_MIN_CLIP_DURATION, 0)
        );
        nextStart = Math.max(current.baseStart + (nextTrimIn - current.baseTrimIn), 0);
        setDragClipStart(nextStart);
        setDragTrimIn(nextTrimIn);
      } else if (current.mode === 'trim-right') {
        const maxEnd = current.baseStart + Math.max(duration - current.baseTrimIn, AUDIO_MIN_CLIP_DURATION);
        let candidateEnd = Math.min(Math.max(pointerTime, current.baseStart + AUDIO_MIN_CLIP_DURATION), maxEnd);
        if (moveEvent.altKey) {
          const nearestCue = findNearestCue(candidateEnd);
          if (Number.isFinite(nearestCue)) candidateEnd = nearestCue;
        }
        nextTrimOut = Math.min(
          Math.max(current.baseTrimIn + (candidateEnd - current.baseStart), current.baseTrimIn + AUDIO_MIN_CLIP_DURATION),
          duration
        );
        setDragTrimOut(nextTrimOut);
      } else if (current.mode === 'fade-in-duration') {
        nextFadeIn = Math.min(Math.max(pointerTime - current.baseStart, 0), Math.max(current.baseTrimOut - current.baseTrimIn, 0));
        setDragFadeInDuration(nextFadeIn);
      } else if (current.mode === 'fade-out-duration') {
        const baseClipEnd = current.baseStart + Math.max(current.baseTrimOut - current.baseTrimIn, 0);
        nextFadeOut = Math.min(Math.max(baseClipEnd - pointerTime, 0), Math.max(current.baseTrimOut - current.baseTrimIn, 0));
        setDragFadeOutDuration(nextFadeOut);
      } else if (current.mode === 'fade-in-curve') {
        const deltaY = moveEvent.clientY - current.startY;
        nextFadeInCurve = Math.min(Math.max(current.baseFadeInCurvature + deltaY / 120, -1), 1);
        setDragFadeInCurvature(nextFadeInCurve);
      } else if (current.mode === 'fade-out-curve') {
        const deltaY = moveEvent.clientY - current.startY;
        nextFadeOutCurve = Math.min(Math.max(current.baseFadeOutCurvature + deltaY / 120, -1), 1);
        setDragFadeOutCurvature(nextFadeOutCurve);
      }

      current.lastStart = nextStart;
      current.lastTrimIn = nextTrimIn;
      current.lastTrimOut = nextTrimOut;
      current.lastFadeInDuration = nextFadeIn;
      current.lastFadeOutDuration = nextFadeOut;
      current.lastFadeInCurvature = nextFadeInCurve;
      current.lastFadeOutCurvature = nextFadeOutCurve;
    };

    const onPointerEnd = () => {
      const current = dragRef.current;
      if (!current) return;
      const patch = {};
      if (current.mode === 'move') {
        patch.clipStart = Number.isFinite(current.lastStart) ? current.lastStart : current.baseStart;
      } else if (current.mode === 'trim-left') {
        patch.clipStart = Number.isFinite(current.lastStart) ? current.lastStart : current.baseStart;
        patch.trimIn = Number.isFinite(current.lastTrimIn) ? current.lastTrimIn : current.baseTrimIn;
      } else if (current.mode === 'trim-right') {
        patch.trimOut = Number.isFinite(current.lastTrimOut) ? current.lastTrimOut : current.baseTrimOut;
      } else if (current.mode === 'fade-in-duration') {
        patch.fadeInEnabled = true;
        patch.fadeInDuration = Number.isFinite(current.lastFadeInDuration)
          ? current.lastFadeInDuration
          : current.baseFadeInDuration;
      } else if (current.mode === 'fade-out-duration') {
        patch.fadeOutEnabled = true;
        patch.fadeOutDuration = Number.isFinite(current.lastFadeOutDuration)
          ? current.lastFadeOutDuration
          : current.baseFadeOutDuration;
      } else if (current.mode === 'fade-in-curve') {
        patch.fadeInEnabled = true;
        patch.fadeInCurvature = Number.isFinite(current.lastFadeInCurvature)
          ? current.lastFadeInCurvature
          : current.baseFadeInCurvature;
      } else if (current.mode === 'fade-out-curve') {
        patch.fadeOutEnabled = true;
        patch.fadeOutCurvature = Number.isFinite(current.lastFadeOutCurvature)
          ? current.lastFadeOutCurvature
          : current.baseFadeOutCurvature;
      }
      dragRef.current = null;
      resetAudioDragState();
      commitAudioPatch(patch);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerEnd);
      window.removeEventListener('pointercancel', onPointerEnd);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerEnd);
    window.addEventListener('pointercancel', onPointerEnd);
  };

  const handleClipPointerDown = (event) => startAudioDrag('move', event);
  const handleTrimLeftPointerDown = (event) => startAudioDrag('trim-left', event);
  const handleTrimRightPointerDown = (event) => startAudioDrag('trim-right', event);
  const handleFadeInPointerDown = (event) => startAudioDrag('fade-in-duration', event);
  const handleFadeOutPointerDown = (event) => startAudioDrag('fade-out-duration', event);
  const handleFadeInCurvePointerDown = (event) => startAudioDrag('fade-in-curve', event);
  const handleFadeOutCurvePointerDown = (event) => startAudioDrag('fade-out-curve', event);

  const handleFadeAreaDoubleClick = (mode, event) => {
    if (!isAudio || !hasAudioClip || typeof onEditAudioFade !== 'function') return;
    event.preventDefault();
    event.stopPropagation();
    onEditAudioFade(track.id, mode);
  };

  const buildFadePath = (startTime, endTime, shape, curvature, isFadeOut = false) => {
    const startX = mapTimeToSvgX(startTime);
    const endX = mapTimeToSvgX(endTime);
    const width = Math.max(endX - startX, 0);
    if (width <= 0.5) return '';
    const top = 10;
    const bottom = 90;
    const steps = 20;
    const points = [];
    for (let i = 0; i <= steps; i += 1) {
      const ratio = i / steps;
      const curve = evaluateAudioFadeCurve(ratio, shape, curvature);
      const gain = isFadeOut ? 1 - curve : curve;
      const x = startX + width * ratio;
      const y = bottom - (bottom - top) * gain;
      points.push(`${x} ${y}`);
    }
    return `M ${startX} ${bottom} L ${points.join(' L ')} L ${endX} ${bottom} Z`;
  };

  const fadeInVisibleDuration = fadeInEnabled ? Math.min(fadeInDuration, activeClipDuration) : 0;
  const fadeOutVisibleDuration = fadeOutEnabled ? Math.min(fadeOutDuration, activeClipDuration) : 0;
  const fadeInStartTime = activeClipStart;
  const fadeInEndTime = activeClipStart + fadeInVisibleDuration;
  const fadeOutStartTime = clipEnd - fadeOutVisibleDuration;
  const fadeOutEndTime = clipEnd;
  const fadeInPath = fadeInVisibleDuration > 0
    ? buildFadePath(
      Math.max(fadeInStartTime, view.start),
      Math.min(fadeInEndTime, view.end),
      fadeInShape,
      fadeInCurvature,
      false
    )
    : '';
  const fadeOutPath = fadeOutVisibleDuration > 0
    ? buildFadePath(
      Math.max(fadeOutStartTime, view.start),
      Math.min(fadeOutEndTime, view.end),
      fadeOutShape,
      -fadeOutCurvature,
      true
    )
    : '';
  const fadeInBoundaryX = mapTimeToSvgX(Math.min(Math.max(fadeInBoundaryTime, view.start), view.end));
  const fadeOutBoundaryX = mapTimeToSvgX(Math.min(Math.max(fadeOutBoundaryTime, view.start), view.end));

  return (
    <div
      ref={laneRef}
      className={`track-lane ${isSelected ? 'is-selected' : ''} ${isAudio ? 'track-lane--audio' : ''} ${isGroup ? 'track-lane--group' : ''} ${isGroupedChild ? 'track-lane--group-child' : ''} ${isDmxColor ? 'track-lane--dmx-color' : ''} ${isOscArray ? 'track-lane--osc-array' : ''} ${isOsc3d ? 'track-lane--osc-3d' : ''}`}
      style={{ height, '--track-accent': trackColor }}
      onClick={() => onSelect(track.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter') onSelect(track.id);
      }}
    >
      {isGroup ? (
        <GroupLane
          track={track}
          members={groupMembers}
          view={view}
          height={height}
          width={timelineWidth}
        />
      ) : isAudio ? (
        <div className="audio-lane" style={{ '--track-accent': trackColor }}>
          {hasAudioClip ? (
            <svg
              className="audio-lane__svg"
              viewBox={`0 0 ${contentWidth} 100`}
              preserveAspectRatio="none"
            >
              <rect x="0" y="0" width={contentWidth} height="100" className="audio-lane__bg" />
              {clipHasVisibleRange && (
                <>
                  <rect
                    x={clipRectX}
                    y="8"
                    width={clipRectWidth}
                    height="84"
                    className="audio-lane__clip"
                  />
                  {waveformLines.map((line) => (
                    <line
                      key={line.key}
                      x1={line.x}
                      y1={line.y}
                      x2={line.x}
                      y2={line.y + line.h}
                      className="audio-lane__line"
                    />
                  ))}
                  <rect
                    x={clipRectX}
                    y="8"
                    width={clipRectWidth}
                    height="84"
                    className="audio-lane__clip-hit"
                    onPointerDown={handleClipPointerDown}
                    onDoubleClick={handleClipDoubleClick}
                  />
                  {fadeInPath && (
                    <>
                      <path
                        d={fadeInPath}
                        className="audio-lane__fade"
                        onPointerDown={handleFadeInPointerDown}
                        onDoubleClick={(event) => handleFadeAreaDoubleClick('in', event)}
                      />
                      <line
                        x1={fadeInBoundaryX}
                        y1="10"
                        x2={fadeInBoundaryX}
                        y2="90"
                        className="audio-lane__fade-handle"
                        onPointerDown={handleFadeInPointerDown}
                      />
                      <circle
                        cx={clipRectX + Math.max((fadeInBoundaryX - clipRectX) * 0.5, 4)}
                        cy={50 + fadeInCurvature * 18}
                        r="4"
                        className="audio-lane__fade-curve-handle"
                        onPointerDown={handleFadeInCurvePointerDown}
                      />
                    </>
                  )}
                  {fadeOutPath && (
                    <>
                      <path
                        d={fadeOutPath}
                        className="audio-lane__fade"
                        onPointerDown={handleFadeOutPointerDown}
                        onDoubleClick={(event) => handleFadeAreaDoubleClick('out', event)}
                      />
                      <line
                        x1={fadeOutBoundaryX}
                        y1="10"
                        x2={fadeOutBoundaryX}
                        y2="90"
                        className="audio-lane__fade-handle"
                        onPointerDown={handleFadeOutPointerDown}
                      />
                      <circle
                        cx={fadeOutBoundaryX + Math.max((clipRectX + clipRectWidth - fadeOutBoundaryX) * 0.5, 4)}
                        cy={50 + fadeOutCurvature * 18}
                        r="4"
                        className="audio-lane__fade-curve-handle"
                        onPointerDown={handleFadeOutCurvePointerDown}
                      />
                    </>
                  )}
                  <rect
                    x={fullClipVisibleStartX}
                    y="8"
                    width={trimHandleWidth}
                    height="84"
                    className="audio-lane__trim-handle audio-lane__trim-handle--left"
                    onPointerDown={handleTrimLeftPointerDown}
                  />
                  <rect
                    x={Math.max(fullClipVisibleEndX - trimHandleWidth, fullClipVisibleStartX)}
                    y="8"
                    width={trimHandleWidth}
                    height="84"
                    className="audio-lane__trim-handle audio-lane__trim-handle--right"
                    onPointerDown={handleTrimRightPointerDown}
                  />
                </>
              )}
            </svg>
          ) : (
            <div className="audio-lane__empty">
              Load audio clip
            </div>
          )}
        </div>
      ) : isDmxColor ? (
        <DmxColorEditor
          track={track}
          view={view}
          height={height}
          width={timelineWidth}
          curveFps={curveFps}
          accentColor={trackColor}
          suspendRendering={suspendRendering}
          isTrackSelected={isSelected}
          externalSelectedIds={externalSelectedNodeIds}
          onSelectTrack={onSelectTrack}
          cues={cues}
          onNodeDrag={(nodeId, patch) => onNodeDrag(track.id, nodeId, patch)}
          onSetNodeCurve={(nodeIds, curve) => onSetNodeCurve?.(track.id, nodeIds, curve)}
          onAddNode={(node) => onAddNode(track.id, node)}
          onEditNode={(nodeId, value, mode, colorHex) => onEditNode(track.id, nodeId, value, mode, colorHex)}
          onDeleteNodes={(nodeIds) => onDeleteNodes(track.id, nodeIds)}
          onSelectionChange={onSelectionChange}
        />
      ) : isOscArray ? (
        <OscArrayEditor
          track={track}
          view={view}
          height={height}
          width={timelineWidth}
          curveFps={curveFps}
          suspendRendering={suspendRendering}
          isTrackSelected={isSelected}
          externalSelectedIds={externalSelectedNodeIds}
          onSelectTrack={onSelectTrack}
          cues={cues}
          onNodeDrag={(nodeId, patch) => onNodeDrag(track.id, nodeId, patch)}
          onSetNodeCurve={(nodeIds, curve) => onSetNodeCurve?.(track.id, nodeIds, curve)}
          onAddNode={(node) => onAddNode(track.id, node)}
          onEditNode={(nodeId, value, mode) => onEditNode(track.id, nodeId, value, mode)}
          onDeleteNodes={(nodeIds) => onDeleteNodes(track.id, nodeIds)}
          onSelectionChange={onSelectionChange}
        />
      ) : isOsc3d ? (
        <Osc3dEditor
          track={track}
          view={view}
          height={height}
          width={timelineWidth}
          curveFps={curveFps}
          suspendRendering={suspendRendering}
          isTrackSelected={isSelected}
          externalSelectedIds={externalSelectedNodeIds}
          onSelectTrack={onSelectTrack}
          cues={cues}
          onNodeDrag={(nodeId, patch) => onNodeDrag(track.id, nodeId, patch)}
          onSetNodeCurve={(nodeIds, curve) => onSetNodeCurve?.(track.id, nodeIds, curve)}
          onAddNode={(node) => onAddNode(track.id, node)}
          onEditNode={(nodeId, value, mode) => onEditNode(track.id, nodeId, value, mode)}
          onDeleteNodes={(nodeIds) => onDeleteNodes(track.id, nodeIds)}
          onSelectionChange={onSelectionChange}
        />
      ) : (
        <NodeEditor
          track={track}
          view={view}
          height={height}
          width={timelineWidth}
          accentColor={trackColor}
          suspendRendering={suspendRendering}
          isTrackSelected={isSelected}
          externalSelectedIds={externalSelectedNodeIds}
          onSelectTrack={onSelectTrack}
          cues={cues}
          onNodeDrag={(nodeId, patch) => onNodeDrag(track.id, nodeId, patch)}
          onSetNodeCurve={(nodeIds, curve) => onSetNodeCurve?.(track.id, nodeIds, curve)}
          onAddNode={(node) => onAddNode(track.id, node)}
          onEditNode={(nodeId, value, mode, colorHex) => onEditNode(track.id, nodeId, value, mode, colorHex)}
          onDeleteNodes={(nodeIds) => onDeleteNodes(track.id, nodeIds)}
          onSelectionChange={onSelectionChange}
        />
      )}
    </div>
  );
}

export default memo(TrackLane, (prev, next) => (
  prev.track === next.track
  && prev.groupMembers === next.groupMembers
  && prev.isGroupedChild === next.isGroupedChild
  && prev.view === next.view
  && prev.height === next.height
  && prev.timelineWidth === next.timelineWidth
  && prev.suspendRendering === next.suspendRendering
  && prev.isSelected === next.isSelected
  && prev.externalSelectedNodeIds === next.externalSelectedNodeIds
  && prev.audioWaveform === next.audioWaveform
  && prev.cues === next.cues
));
