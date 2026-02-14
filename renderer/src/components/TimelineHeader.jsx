import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  TIMELINE_PADDING,
  clamp,
  formatTimecode,
} from '../utils/timelineMetrics.js';

export default function TimelineHeader({
  view,
  fps,
  playhead,
  width,
  onSeek,
  onScroll,
  cues = [],
  onCueEdit,
  onCueAdd,
  onCueMove,
  onCueDelete,
}) {
  const TIMELINE_HEADER_HEIGHT = 72;
  const TICK_TOP = 24;
  const TICK_BOTTOM = 44;
  const BASELINE_Y = 52;
  const CUE_TOP = 34;
  const CUE_BOTTOM = 62;
  const CUE_DOT_Y = 44;
  const CUE_MARKER_HALF = 11;
  const svgRef = useRef(null);
  const cueDragRef = useRef(null);
  const [cueMenu, setCueMenu] = useState(null);
  const timelineWidth = Number(width) || 900;
  const svgWidth = Math.max(timelineWidth, TIMELINE_PADDING * 2 + 1);
  const duration = view.end - view.start;

  const mapTimeToLocalX = (time) => {
    const span = Math.max(duration || 0, 0.0001);
    return ((time - view.start) / span) * (svgWidth - 2 * TIMELINE_PADDING) + TIMELINE_PADDING;
  };

  const mapLocalXToTime = (x) => {
    const span = Math.max(duration || 0, 0.0001);
    return view.start + ((x - TIMELINE_PADDING) / (svgWidth - 2 * TIMELINE_PADDING)) * span;
  };

  const tickCount = Math.max(6, Math.min(20, Math.round(timelineWidth / 130)));
  const ticks = useMemo(
    () => Array.from({ length: tickCount }, (_, index) => (
      view.start + (duration * index) / (tickCount - 1)
    )),
    [duration, tickCount, view.start]
  );

  useEffect(() => {
    if (!cueMenu) return undefined;
    const closeMenu = (event) => {
      if (event.target?.closest?.('.timeline-cue-menu')) return;
      setCueMenu(null);
    };
    const handleEscape = (event) => {
      if (event.key === 'Escape') setCueMenu(null);
    };
    window.addEventListener('pointerdown', closeMenu, true);
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('pointerdown', closeMenu, true);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [cueMenu]);

  const handleClick = (event) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * svgWidth;
    const time = clamp(mapLocalXToTime(x), view.start, view.end);
    onSeek(time);
  };

  const handleDoubleClick = (event) => {
    if (!onCueAdd) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * svgWidth;
    const time = clamp(mapLocalXToTime(x), view.start, view.end);
    onCueAdd(time);
  };

  const numberedCues = cues.map((cue, index) => ({ ...cue, number: index + 1 }));
  const visibleCues = numberedCues.filter((cue) => cue.t >= view.start && cue.t <= view.end);
  const playheadTime = clamp(typeof playhead === 'number' ? playhead : view.start, view.start, view.end);
  const playheadX = mapTimeToLocalX(playheadTime);

  const beginCueDrag = (event, cue) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    setCueMenu(null);
    if (svgRef.current?.setPointerCapture) {
      svgRef.current.setPointerCapture(event.pointerId);
    }
    cueDragRef.current = {
      cueId: cue.id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };
  };

  const updateCueDrag = (event) => {
    if (!cueDragRef.current || !svgRef.current || !onCueMove) return;
    const dx = Math.abs(event.clientX - cueDragRef.current.startX);
    const dy = Math.abs(event.clientY - cueDragRef.current.startY);
    if (!cueDragRef.current.moved && dx < 2 && dy < 2) return;
    cueDragRef.current.moved = true;
    const rect = svgRef.current.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * svgWidth;
    const time = clamp(mapLocalXToTime(x), view.start, view.end);
    onCueMove(cueDragRef.current.cueId, time);
  };

  const endCueDrag = () => {
    if (cueDragRef.current?.pointerId && svgRef.current?.releasePointerCapture) {
      try {
        svgRef.current.releasePointerCapture(cueDragRef.current.pointerId);
      } catch (error) {
        // Ignore capture release errors.
      }
    }
    cueDragRef.current = null;
  };

  return (
    <div className="timeline-scale">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${svgWidth} ${TIMELINE_HEADER_HEIGHT}`}
        preserveAspectRatio="none"
        className="timeline-scale__svg"
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onPointerMove={updateCueDrag}
        onPointerUp={endCueDrag}
        onPointerCancel={endCueDrag}
        onPointerLeave={endCueDrag}
        onContextMenu={(event) => event.preventDefault()}
      >
        <rect x="0" y="0" width={svgWidth} height={TIMELINE_HEADER_HEIGHT} className="timeline-scale__bg" />
        {ticks.map((tick) => {
          const x = mapTimeToLocalX(tick);
          return (
            <g key={tick}>
              <line
                x1={x}
                y1={TICK_TOP}
                x2={x}
                y2={TICK_BOTTOM}
                className="timeline-scale__line"
              />
            </g>
          );
        })}
        <line
          x1={TIMELINE_PADDING}
          y1={BASELINE_Y}
          x2={svgWidth - TIMELINE_PADDING}
          y2={BASELINE_Y}
          className="timeline-scale__baseline"
        />
        <line
          x1={playheadX}
          y1={0}
          x2={playheadX}
          y2={TIMELINE_HEADER_HEIGHT}
          className="timeline-scale__playhead"
        />
        {visibleCues.map((cue) => {
          const x = mapTimeToLocalX(cue.t);
          return (
            <g
              key={cue.id}
              className="timeline-cue"
              onClick={(event) => {
                event.stopPropagation();
              }}
              onDoubleClick={(event) => event.stopPropagation()}
              onPointerDown={(event) => beginCueDrag(event, cue)}
              onContextMenu={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setCueMenu({
                  cueId: cue.id,
                  cue,
                  x: event.clientX,
                  y: event.clientY,
                });
              }}
            >
              <line x1={x} y1={CUE_TOP} x2={x} y2={CUE_BOTTOM} />
              <polygon
                className="timeline-cue__marker"
                points={`${x},${CUE_DOT_Y - CUE_MARKER_HALF} ${x + CUE_MARKER_HALF},${CUE_DOT_Y} ${x},${CUE_DOT_Y + CUE_MARKER_HALF} ${x - CUE_MARKER_HALF},${CUE_DOT_Y}`}
              />
              <text
                x={x}
                y={CUE_DOT_Y}
                className="timeline-cue__label"
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {cue.number}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="timeline-scale__labels">
        {ticks.map((tick) => {
          const x = mapTimeToLocalX(tick);
          const percent = (x / svgWidth) * 100;
          return (
            <span
              key={`label-${tick}`}
              className="timeline-scale__label"
              style={{ left: `${percent}%` }}
            >
              {formatTimecode(tick, fps)}
            </span>
          );
        })}
      </div>
      {cueMenu && (
        <div className="timeline-cue-menu" style={{ left: cueMenu.x, top: cueMenu.y }}>
          <button
            type="button"
            className="timeline-cue-menu__item"
            onClick={() => {
              if (onCueEdit && cueMenu.cue) onCueEdit(cueMenu.cue);
              setCueMenu(null);
            }}
          >
            Edit Cue
          </button>
          <button
            type="button"
            className="timeline-cue-menu__item"
            onClick={() => {
              if (onCueDelete) onCueDelete(cueMenu.cueId);
              setCueMenu(null);
            }}
          >
            Delete Cue
          </button>
        </div>
      )}
      <input
        className="timeline-scroll"
        type="range"
        min="0"
        max={Math.max(view.length - (view.end - view.start), 0)}
        step="0.01"
        value={view.start}
        onChange={(event) => onScroll(Number(event.target.value))}
      />
    </div>
  );
}
