import { Icon } from "./ui/icons";
import { Field } from "./ui/field";
import { Button, IconButton } from "./ui/button";
import { TextInput } from "./ui/input";
import { useState, type CSSProperties, type FormEvent } from "react";

interface ApiKeyInputProps {
  providerName: string;
  keyPlaceholder: string;
  onSubmit: (key: string) => void;
  isLoading?: boolean;
  error?: string | null;
}

export function ApiKeyInput({
  onSubmit,
  isLoading,
  error,
  providerName,
  keyPlaceholder,
}: ApiKeyInputProps) {
  const [key, setKey] = useState("");
  const [showKey, setShowKey] = useState(false);

  const normalizedKey = key.trim();
  const isValid = normalizedKey.length >= 20;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (isValid && !isLoading) {
      onSubmit(normalizedKey);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <Field
        label={`${providerName} API key`}
        labelStyle={styles.label}
        style={{ gap: 12 }}
        error={error}
        description="Your key is encrypted and stored locally on your device."
        descriptionStyle={styles.hint}
      >
        {(control) => (
          <>
            <div
              className={error ? "animate-shake" : undefined}
              style={styles.inputWrapper}
            >
              <TextInput
                {...control}
                spellCheck={false}
                autoCapitalize="none"
                type={showKey ? "text" : "password"}
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder={keyPlaceholder}
                style={styles.input}
                disabled={isLoading}
              />
              <IconButton
                variant="plain"
                onClick={() => setShowKey(!showKey)}
                style={styles.toggleButton}
                aria-label={showKey ? "Hide API key" : "Show API key"}
                aria-pressed={showKey}
              >
                {showKey ? <Icon name="eye-off" /> : <Icon name="eye" />}
              </IconButton>
            </div>

            {!error && key.length > 0 && !isValid && (
              <p className="animate-fadeIn" style={styles.hint} role="status">
                {`${providerName} API keys start with “${prefixFromPlaceholder(keyPlaceholder)}”. Paste the full key to continue.`}
              </p>
            )}
          </>
        )}
      </Field>

      <Button
        variant="primary"
        type="submit"
        style={styles.submitButton}
        disabled={!isValid}
        loading={isLoading}
        loadingLabel="Validating…"
      >
        Get Started
        <Icon name="arrow-right" size={16} />
      </Button>
    </form>
  );
}

function prefixFromPlaceholder(placeholder: string): string {
  const prefix = placeholder.replace(/\.+$/u, "").trim();
  return prefix.length > 0 ? prefix : placeholder;
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
