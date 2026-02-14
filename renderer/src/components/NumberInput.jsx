import React, { useEffect, useMemo, useRef, useState } from 'react';

const toInputText = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (Number.isFinite(value)) return String(value);
  return '';
};

export default function NumberInput({
  value,
  onChange,
  onBlur,
  onFocus,
  ...rest
}) {
  const [draft, setDraft] = useState(toInputText(value));
  const isEditingRef = useRef(false);
  const stableValue = useMemo(() => toInputText(value), [value]);

  useEffect(() => {
    if (isEditingRef.current) return;
    setDraft(stableValue);
  }, [stableValue]);

  const emitChange = (nextValue) => {
    if (typeof onChange !== 'function') return;
    onChange({ target: { value: nextValue } });
  };

  return (
    <input
      {...rest}
      type="number"
      value={draft}
      onFocus={(event) => {
        isEditingRef.current = true;
        if (typeof onFocus === 'function') onFocus(event);
      }}
      onChange={(event) => {
        const nextText = event.target.value;
        setDraft(nextText);
        if (nextText === '') return;
        emitChange(nextText);
      }}
      onBlur={(event) => {
        isEditingRef.current = false;
        if (draft === '') {
          setDraft(stableValue);
          if (typeof onBlur === 'function') onBlur(event);
          return;
        }
        if (typeof onBlur === 'function') onBlur(event);
      }}
    />
  );
}
