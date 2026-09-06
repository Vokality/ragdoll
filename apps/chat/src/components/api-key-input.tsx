import { useState, useId, type CSSProperties, type FormEvent } from "react";

interface ApiKeyInputProps {
  onSubmit: (key: string) => void;
  isLoading?: boolean;
  error?: string | null;
}

export function ApiKeyInput({ onSubmit, isLoading, error }: ApiKeyInputProps) {
  const inputId = useId();
  const [key, setKey] = useState("");
  const [showKey, setShowKey] = useState(false);

  const normalizedKey = key.trim();
  const isValid = normalizedKey.startsWith("sk-") && normalizedKey.length > 20;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (isValid && !isLoading) {
      onSubmit(normalizedKey);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <label htmlFor={inputId} style={styles.label}>
        OpenAI API key
      </label>
      <div
        className={error ? "animate-shake" : undefined}
        style={styles.inputWrapper}
      >
        <input
          id={inputId}
          aria-describedby={`${inputId}-privacy${error ? ` ${inputId}-error` : ""}`}
          aria-invalid={!!error}
          spellCheck={false}
          autoCapitalize="none"
          type={showKey ? "text" : "password"}
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="sk-..."
          style={{
            ...styles.input,
            borderColor: error ? "var(--error)" : undefined,
          }}
          disabled={isLoading}
          autoFocus
        />
        <button
          type="button"
          onClick={() => setShowKey(!showKey)}
          style={styles.toggleButton}
          aria-label={showKey ? "Hide API key" : "Show API key"}
          aria-pressed={showKey}
        >
          {showKey ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>

      {error && (
        <p
          id={`${inputId}-error`}
          className="animate-fadeIn"
          role="alert"
          style={styles.error}
        >
          {error}
        </p>
      )}

      {!error && key.length > 0 && !isValid && (
        <p className="animate-fadeIn" style={styles.hint} role="status">
          OpenAI API keys start with “sk-”. Paste the full key to continue.
        </p>
      )}

      <p id={`${inputId}-privacy`} style={styles.hint}>
        Your key is encrypted and stored locally on your device.
      </p>

      <button
        type="submit"
        className="btn-primary"
        style={styles.submitButton}
        disabled={!isValid || isLoading}
      >
        {isLoading ? (
          <>
            <span className="spinner-sm" />
            Validating…
          </>
        ) : (
          <>
            Get Started
            <ArrowIcon />
          </>
        )}
      </button>
    </form>
  );
}

function EyeIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

const styles: Record<string, CSSProperties> = {
  label: { fontSize: "13px", fontWeight: "500", marginBottom: "-4px" },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    width: "100%",
  },
  inputWrapper: {
    position: "relative",
    display: "flex",
    alignItems: "center",
  },
  input: {
    width: "100%",
    padding: "10px 44px 10px 12px",
    fontSize: "14px",
    fontFamily: "var(--font-mono)",
    letterSpacing: "0.5px",
    background: "var(--bg-secondary)",
  },
  toggleButton: {
    position: "absolute",
    right: "12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "4px",
    color: "var(--text-dim)",
    transition: "color var(--transition-fast)",
    cursor: "pointer",
  },
  error: {
    color: "var(--error)",
    fontSize: "13px",
    margin: "0",
  },
  hint: {
    color: "var(--text-dim)",
    fontSize: "13px",
    margin: "0",
  },
  submitButton: {
    marginTop: "8px",
    width: "100%",
  },
};
