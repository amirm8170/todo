import { useState, type FormEvent, type ReactNode } from 'react';
import { ApiError } from '../api';
import { PhoneFrame } from '../phone';

type AuthFormProps = {
  title: string;
  subtitle: string;
  submitLabel: string;
  submittingLabel: string;
  passwordAutoComplete: 'current-password' | 'new-password';
  footer: ReactNode;
  errorFallback: string;
  onSubmit: (email: string, password: string) => Promise<void>;
  onSuccess: () => void;
};

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function AuthForm({
  title,
  subtitle,
  submitLabel,
  submittingLabel,
  passwordAutoComplete,
  footer,
  errorFallback,
  onSubmit,
  onSuccess,
}: AuthFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [shake, setShake] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setShake(false);
    setSubmitting(true);

    try {
      await onSubmit(email.trim(), password);
      setLeaving(true);
      if (!prefersReducedMotion()) {
        await new Promise((resolve) => window.setTimeout(resolve, 280));
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : errorFallback);
      setShake(true);
      window.setTimeout(() => setShake(false), 480);
      setSubmitting(false);
    }
  }

  return (
    <PhoneFrame>
      <form
        className={`auth${shake ? ' is-shake' : ''}${leaving ? ' is-leaving' : ''}`}
        onSubmit={handleSubmit}
      >
        <div className="auth-mark" aria-hidden="true">
          <CheckIcon />
        </div>

        <header className="auth-header">
          <h1>{title}</h1>
          <p className="muted">{subtitle}</p>
        </header>

        {error ? <p className="error">{error}</p> : null}

        <label className="field">
          Email
          <input
            type="email"
            name="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              if (error) setError('');
            }}
            autoComplete="email"
            inputMode="email"
            required
          />
        </label>

        <label className="field">
          Password
          <input
            type="password"
            name="password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              if (error) setError('');
            }}
            autoComplete={passwordAutoComplete}
            minLength={8}
            required
          />
        </label>

        <button className="btn btn-primary btn-block" type="submit" disabled={submitting}>
          {submitting ? submittingLabel : submitLabel}
        </button>

        <p className="auth-footer">{footer}</p>
      </form>
    </PhoneFrame>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22">
      <path
        d="M6.4 12.2 10.1 16l7.5-8.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
