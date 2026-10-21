import { useState } from 'react';

/** Copies text to the clipboard when the browser allows it; the text stays selectable anyway. */
function copy(text: string, done: (ok: boolean) => void): void {
  if (typeof navigator.clipboard === 'undefined') {
    done(false);
    return;
  }
  navigator.clipboard.writeText(text).then(
    () => {
      done(true);
    },
    () => {
      done(false);
    },
  );
}

export function CopyButton({ text, label }: { text: string; label: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  return (
    <button
      type="button"
      onClick={() => {
        copy(text, (ok) => {
          setState(ok ? 'copied' : 'failed');
        });
      }}
    >
      {state === 'copied'
        ? 'Copied'
        : state === 'failed'
          ? `${label} (select the text and copy it)`
          : label}
    </button>
  );
}

export interface TextDialogProps {
  readonly title: string;
  readonly text: string;
  readonly copyLabel: string;
  readonly onClose: () => void;
  readonly multiline: boolean;
}

/** A dialog showing a text to copy (share link, debug report). */
export function TextDialog({ title, text, copyLabel, onClose, multiline }: TextDialogProps) {
  return (
    <div className="dialog" role="dialog" aria-label={title}>
      <h2>{title}</h2>
      {multiline ? (
        <textarea readOnly value={text} aria-label={`${title} content`} rows={12} />
      ) : (
        <input
          readOnly
          value={text}
          aria-label={`${title} content`}
          onFocus={(e) => {
            e.target.select();
          }}
        />
      )}
      <div>
        <CopyButton text={text} label={copyLabel} />
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

export interface ErrorBannerProps {
  readonly message: string;
  readonly report: () => string;
  readonly onClose: () => void;
}

/** An internal error (a bug): what happened and the debug report to send (note D). */
export function ErrorBanner({ message, report, onClose }: ErrorBannerProps) {
  return (
    <div className="error-banner" role="alert">
      <strong>Internal error:</strong> {message}. Please send the debug report.{' '}
      <CopyButton text={report()} label="Copy debug report" />
      <button type="button" onClick={onClose}>
        Dismiss
      </button>
    </div>
  );
}
