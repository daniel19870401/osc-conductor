import React, { useEffect, useRef } from 'react';

const parseNumber = (value, fallback) => {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
};

export default function InspectorPanel({
  track,
  onPatch,
  onAddNode,
  onAudioFile,
  onNameEnterNext,
  nameFocusToken,
  midiOutputOptions = [],
  virtualMidiOutputId = 'virtual-midi-out',
  virtualMidiOutputName = 'OSC DAW MIDI OUT',
}) {
  const nameInputRef = useRef(null);
  const lastHandledNameFocusTokenRef = useRef(nameFocusToken);
  const safeMidiOutputs = Array.isArray(midiOutputOptions) ? midiOutputOptions : [];

  useEffect(() => {
    if (!Number.isFinite(nameFocusToken) || nameFocusToken <= 0) return;
    if (nameFocusToken === lastHandledNameFocusTokenRef.current) return;
    lastHandledNameFocusTokenRef.current = nameFocusToken;
    if (!track) return;
    if (!nameInputRef.current) return;
    nameInputRef.current.focus();
    nameInputRef.current.select();
  }, [nameFocusToken]);

  if (!track) {
    return (
      <aside className="inspector">
        <div className="panel-header">
          <div className="label">Inspector</div>
        </div>
        <div className="inspector__empty">Select a track</div>
      </aside>
    );
  }

  return (
    <aside className="inspector">
      <div className="panel-header">
        <div className="label">Inspector</div>
      </div>
      <div className="inspector__content">
        <div className="inspector__section">
          <div className="inspector__title">Track</div>
          <div className="field">
            <label>Name</label>
            <input
              ref={nameInputRef}
              className="input"
              value={track.name ?? ''}
              onChange={(event) => onPatch({ name: event.target.value })}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                if (onNameEnterNext) onNameEnterNext();
              }}
            />
          </div>
          {track.kind === 'osc' && (
            <div className="field-grid">
              <div className="field">
                <label>Min</label>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  value={Number.isFinite(track.min) ? track.min : 0}
                  onChange={(event) => onPatch({ min: parseNumber(event.target.value, 0) })}
                />
              </div>
              <div className="field">
                <label>Max</label>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  value={Number.isFinite(track.max) ? track.max : 1}
                  onChange={(event) => onPatch({ max: parseNumber(event.target.value, 1) })}
                />
              </div>
            </div>
          )}
        </div>
        {track.kind === 'audio' ? (
          <div className="inspector__section" key="audio-inspector">
            <div className="inspector__title">Audio</div>
            <div className="field">
              <label>Clip</label>
              <input
                className="input"
                type="file"
                accept="audio/*"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file && onAudioFile) onAudioFile(file);
                  event.target.value = '';
                }}
              />
            </div>
            <div className="inspector__row">
              <span>Loaded</span>
              <span className="inspector__value">{track.audio?.name || 'None'}</span>
            </div>
              <div className="field">
                <label>Volume</label>
                <input
                  className="input"
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={Number.isFinite(track.audio?.volume) ? track.audio.volume : 1}
                  onChange={(event) =>
                    onPatch({
                    audio: { volume: parseNumber(event.target.value, 1) },
                  })
                }
              />
              <div className="field__hint">
                {Number(Number.isFinite(track.audio?.volume) ? track.audio.volume : 1).toFixed(2)}
              </div>
            </div>
          </div>
        ) : track.kind === 'midi' ? (
          <div className="inspector__section" key="midi-inspector">
            <div className="inspector__title">MIDI</div>
            <div className="field">
              <label>MIDI Out Port</label>
              <select
                className="input"
                value={typeof track.midi?.outputId === 'string' && track.midi.outputId
                  ? track.midi.outputId
                  : virtualMidiOutputId}
                onChange={(event) =>
                  onPatch({
                    midi: { outputId: event.target.value },
                  })}
              >
                <option value={virtualMidiOutputId}>{virtualMidiOutputName}</option>
                {safeMidiOutputs
                  .filter((device) => device.id !== virtualMidiOutputId)
                  .map((device) => (
                    <option key={device.id} value={device.id}>
                      {device.name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="field-grid">
              <div className="field">
                <label>Channel</label>
                <input
                  className="input"
                  type="number"
                  min="1"
                  max="16"
                  step="1"
                  value={Number.isFinite(track.midi?.channel) ? track.midi.channel : 1}
                  onChange={(event) =>
                    onPatch({
                      midi: { channel: parseNumber(event.target.value, 1) },
                    })}
                />
              </div>
              <div className="field">
                <label>Type</label>
                <select
                  className="input"
                  value={track.midi?.mode === 'note' ? 'note' : 'cc'}
                  onChange={(event) =>
                    onPatch({
                      midi: { mode: event.target.value === 'note' ? 'note' : 'cc' },
                    })}
                >
                  <option value="cc">Control Change (CC)</option>
                  <option value="note">Note On/Off</option>
                </select>
              </div>
            </div>
            {track.midi?.mode === 'note' ? (
              <div className="field-grid">
                <div className="field">
                  <label>Note</label>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    max="127"
                    step="1"
                    value={Number.isFinite(track.midi?.note) ? track.midi.note : 60}
                    onChange={(event) =>
                      onPatch({
                        midi: { note: parseNumber(event.target.value, 60) },
                      })}
                  />
                </div>
                <div className="field">
                  <label>Velocity</label>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    max="127"
                    step="1"
                    value={Number.isFinite(track.midi?.velocity) ? track.midi.velocity : 100}
                    onChange={(event) =>
                      onPatch({
                        midi: { velocity: parseNumber(event.target.value, 100) },
                      })}
                  />
                </div>
              </div>
            ) : (
              <div className="field">
                <label>Control Number</label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  max="127"
                  step="1"
                  value={Number.isFinite(track.midi?.controlNumber) ? track.midi.controlNumber : 1}
                  onChange={(event) =>
                    onPatch({
                      midi: { controlNumber: parseNumber(event.target.value, 1) },
                    })}
                />
              </div>
            )}
            <div className="field__hint">
              {track.midi?.mode === 'note'
                ? 'Nodes use 0/1 gate. >= 0.5 sends Note On, < 0.5 sends Note Off.'
                : 'Node values send MIDI CC values (0-127).'}
            </div>
            <div className="inspector__row">
              <span>Nodes</span>
              <span className="inspector__value">{Array.isArray(track.nodes) ? track.nodes.length : 0}</span>
            </div>
          </div>
        ) : track.kind === 'dmx' ? (
          <div className="inspector__section" key="dmx-inspector">
            <div className="inspector__title">DMX (Art-Net)</div>
            <div className="field">
              <label>Art-Net IP</label>
              <input
                className="input input--mono"
                value={typeof track.dmx?.host === 'string' ? track.dmx.host : '127.0.0.1'}
                onChange={(event) =>
                  onPatch({
                    dmx: { host: event.target.value },
                  })}
              />
            </div>
            <div className="field-grid">
              <div className="field">
                <label>Universe</label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  max="32767"
                  step="1"
                  value={Number.isFinite(track.dmx?.universe) ? track.dmx.universe : 0}
                  onChange={(event) =>
                    onPatch({
                      dmx: { universe: parseNumber(event.target.value, 0) },
                    })}
                />
              </div>
              <div className="field">
                <label>Channel</label>
                <input
                  className="input"
                  type="number"
                  min="1"
                  max="512"
                  step="1"
                  value={Number.isFinite(track.dmx?.channel) ? track.dmx.channel : 1}
                  onChange={(event) =>
                    onPatch({
                      dmx: { channel: parseNumber(event.target.value, 1) },
                    })}
                />
              </div>
            </div>
            <div className="inspector__row">
              <span>Nodes</span>
              <span className="inspector__value">{Array.isArray(track.nodes) ? track.nodes.length : 0}</span>
            </div>
          </div>
        ) : (
          <div className="inspector__section" key="osc-inspector">
            <div className="inspector__title">OSC</div>
            <div className="field">
              <label>Address</label>
              <input
                className="input input--mono"
                value={track.oscAddress ?? ''}
                onChange={(event) => onPatch({ oscAddress: event.target.value })}
              />
            </div>
            <div className="inspector__row">
              <span>Nodes</span>
              <span className="inspector__value">{Array.isArray(track.nodes) ? track.nodes.length : 0}</span>
            </div>
          </div>
        )}
        {track.kind !== 'audio' && (
          <div className="inspector__section">
            <div className="inspector__title">Actions</div>
            <div className="inspector__buttons">
              <button className="btn btn--ghost" onClick={onAddNode}>Add Node</button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
