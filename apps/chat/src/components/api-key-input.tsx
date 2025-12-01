import { useState, type CSSProperties, type FormEvent } from "react";

interface ApiKeyInputProps {
  onSubmit: (key: string) => void;
  isLoading?: boolean;
  error?: string | null;
}

export function ApiKeyInput({ onSubmit, isLoading, error }: ApiKeyInputProps) {
  const [key, setKey] = useState("");
  const [showKey, setShowKey] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (key.trim() && !isLoading) {
      onSubmit(key.trim());
    }
  };

  const isValid = key.startsWith("sk-") && key.length > 20;

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <div style={styles.inputWrapper}>
        <input
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
          tabIndex={-1}
        >
          {showKey ? (
            <EyeOffIcon />
          ) : (
            <EyeIcon />
          )}
        </button>
      </div>

      {error && (
        <p style={styles.error}>{error}</p>
      )}

      <p style={styles.hint}>
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
            <span style={styles.buttonSpinner} />
            Validating...
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
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

const styles: Record<string, CSSProperties> = {
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    width: "100%",
  },
  inputWrapper: {
    position: "relative",
    display: "flex",
    alignItems: "center",
  },
  input: {
    width: "100%",
    padding: "14px 48px 14px 16px",
    fontSize: "15px",
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
  buttonSpinner: {
    width: "16px",
    height: "16px",
    border: "2px solid transparent",
    borderTopColor: "currentColor",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
  },
};

