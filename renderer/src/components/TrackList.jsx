import React from 'react';

export default function TrackList({ tracks, selectedId, trackHeight, offset = 0, onSelect, onAddTrack, bodyRef }) {
  return (
    <aside className="track-list">
      <div className="panel-header">
        <div className="label">Tracks</div>
        <button className="btn btn--tiny" onClick={onAddTrack}>+ Add</button>
      </div>
      <div className="track-list__body" ref={bodyRef} style={{ paddingTop: offset }}>
        {tracks.map((track, index) => (
          <button
            key={track.id}
            className={`track-row ${selectedId === track.id ? 'is-selected' : ''}`}
            onClick={() => onSelect(track.id)}
            style={{ minHeight: trackHeight, height: trackHeight }}
          >
            <div className="track-row__title">
              <span className="track-row__index">{String(index + 1).padStart(2, '0')}</span>
              <span className="track-row__name">{track.name}</span>
            </div>
            <div className="track-row__meta">
              <span>{track.min}..{track.max}</span>
              <span className="track-row__osc">{track.oscAddress}</span>
            </div>
          </button>
        ))}
      </div>
    </aside>
  );
}
