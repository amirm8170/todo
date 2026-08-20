import { useEffect, useRef, useState, type FormEvent } from 'react';

type TodoSheetProps = {
  open: boolean;
  titleLabel: string;
  submitLabel: string;
  submittingLabel: string;
  initialTitle: string;
  initialDescription: string;
  onClose: () => void;
  onSubmit: (title: string, description: string) => Promise<void>;
};

export function TodoSheet({
  open,
  titleLabel,
  submitLabel,
  submittingLabel,
  initialTitle,
  initialDescription,
  onClose,
  onSubmit,
}: TodoSheetProps) {
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(initialTitle);
    setDescription(initialDescription);
    setError('');
    const id = window.setTimeout(() => titleRef.current?.focus(), 40);
    return () => window.clearTimeout(id);
  }, [open, initialTitle, initialDescription]);

  useEffect(() => {
    if (!open) return;

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('Title is required');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await onSubmit(trimmedTitle, description.trim());
      onClose();
    } catch {
      // Parent already stores the API error.
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div className="sheet-root">
      <button
        className="sheet-backdrop"
        type="button"
        aria-label="Close"
        onClick={onClose}
      />
      <form
        className="sheet"
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="todo-sheet-title"
      >
        <h2 id="todo-sheet-title">{titleLabel}</h2>
        {error ? <p className="error">{error}</p> : null}
        <label className="field">
          Title
          <input
            ref={titleRef}
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              if (error) setError('');
            }}
            maxLength={255}
            required
          />
        </label>
        <label className="field">
          Description
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            placeholder="Optional"
          />
        </label>
        <button className="btn btn-primary btn-block" type="submit" disabled={submitting}>
          {submitting ? submittingLabel : submitLabel}
        </button>
        <button className="btn btn-ghost btn-block" type="button" onClick={onClose}>
          Cancel
        </button>
      </form>
    </div>
  );
}
