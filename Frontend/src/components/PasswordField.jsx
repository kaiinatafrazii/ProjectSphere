import { useId, useRef, useState } from 'react';

export default function PasswordField({ label = 'Password', name = 'password', value, onChange, autoComplete = 'current-password', required = true, minLength }) {
  const [visible, setVisible] = useState(false);
  const inputRef = useRef(null);
  const id = useId();

  const toggleVisibility = () => {
    const input = inputRef.current;
    const selection = input ? [input.selectionStart, input.selectionEnd] : null;
    setVisible((current) => !current);
    requestAnimationFrame(() => {
      if (!inputRef.current) return;
      inputRef.current.focus();
      if (selection?.[0] !== null && selection?.[1] !== null) {
        inputRef.current.setSelectionRange(selection[0], selection[1]);
      }
    });
  };

  return (
    <label className="password-label" htmlFor={id}>
      {label}
      <span className="password-control">
        <input
          ref={inputRef}
          id={id}
          type={visible ? 'text' : 'password'}
          name={name}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          required={required}
          minLength={minLength}
        />
        <button
          className="password-toggle"
          type="button"
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          onMouseDown={(event) => event.preventDefault()}
          onClick={toggleVisibility}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            {visible ? (
              <>
                <path d="M3 3l18 18" />
                <path d="M10.6 10.7a2 2 0 002.7 2.7" />
                <path d="M9.9 5.2A10.7 10.7 0 0112 5c5.1 0 8.6 4.7 9.5 6.2a1.5 1.5 0 010 1.6 14.6 14.6 0 01-3.1 3.5" />
                <path d="M6.2 6.3a14.6 14.6 0 00-3.7 4.9 1.5 1.5 0 000 1.6C3.4 14.3 6.9 19 12 19a10 10 0 004.1-.9" />
              </>
            ) : (
              <>
                <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z" />
                <circle cx="12" cy="12" r="2.5" />
              </>
            )}
          </svg>
        </button>
      </span>
    </label>
  );
}
