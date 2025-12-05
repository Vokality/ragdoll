import { useState, useEffect, type CSSProperties } from "react";

interface ConfigField {
  type: "string" | "number" | "boolean" | "select";
  label: string;
  description?: string;
  required?: boolean;
  default?: string | number | boolean;
  placeholder?: string;
  secret?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  min?: number;
  max?: number;
  step?: number;
  options?: Array<{ value: string; label: string }>;
}

interface ConfigSchema {
  [key: string]: ConfigField;
}

interface ExtensionConfigStatus {
  isConfigured: boolean;
  missingFields: string[];
  values: Record<string, unknown>;
}

interface OAuthState {
  status: "disconnected" | "connecting" | "connected" | "error" | "expired";
  isAuthenticated: boolean;
  expiresAt?: number;
  error?: string;
}

interface ExtensionConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  extensionId: string;
  extensionName: string;
  hasOAuth: boolean;
  hasConfig: boolean;
  configSchema?: ConfigSchema;
  onConfigured?: () => void;
}

export function ExtensionConfigModal({
  isOpen,
  onClose,
  extensionId,
  extensionName,
  hasOAuth,
  hasConfig,
  configSchema: initialConfigSchema,
  onConfigured,
}: ExtensionConfigModalProps) {
  const [configStatus, setConfigStatus] = useState<ExtensionConfigStatus | null>(null);
  const [configSchema, setConfigSchema] = useState<ConfigSchema | undefined>(initialConfigSchema);
  const [oauthState, setOauthState] = useState<OAuthState | null>(null);
  const [configValues, setConfigValues] = useState<Record<string, string | number | boolean>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      if (hasConfig) {
        // Fetch schema if not provided
        if (!configSchema) {
          const schema = await window.electronAPI.getConfigSchema(extensionId);
          if (schema) {
            setConfigSchema(schema);
          }
        }

        const status = await window.electronAPI.getConfigStatus(extensionId);
        setConfigStatus(status);
        if (status?.values) {
          const initial: Record<string, string | number | boolean> = {};
          for (const [key, value] of Object.entries(status.values)) {
            if (value !== undefined && value !== null && typeof value !== "object") {
              initial[key] = value as string | number | boolean;
            }
          }
          setConfigValues(initial);
        }
      }

      if (hasOAuth) {
        await loadOAuthState();
      }
    } catch (err) {
      console.error("Failed to load extension config:", err);
    }
  };

  const loadOAuthState = async () => {
    const state = await window.electronAPI.getOAuthState(extensionId);
    setOauthState(state);
  };

  // Load initial data
  useEffect(() => {
    if (isOpen) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, extensionId]);

  // Listen for OAuth events
  useEffect(() => {
    if (!isOpen || !hasOAuth) return;

    const unsubSuccess = window.electronAPI.onOAuthSuccess((event) => {
      if (event.extensionId === extensionId) {
        loadOAuthState();
      }
    });

    const unsubError = window.electronAPI.onOAuthError((event) => {
      if (event.extensionId === extensionId) {
        setError(event.error ?? "OAuth authentication failed");
        loadOAuthState();
      }
    });

    return () => {
      unsubSuccess();
      unsubError();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, extensionId, hasOAuth]);

  const handleConfigChange = (key: string, value: string | number | boolean) => {
    setConfigValues((prev) => ({ ...prev, [key]: value }));
    setError(null);
  };

  const handleSaveConfig = async () => {
    if (!configSchema) return;

    setSaving(true);
    setError(null);

    try {
      for (const [key, value] of Object.entries(configValues)) {
        if (value !== undefined && value !== "") {
          const result = await window.electronAPI.setConfigValue(extensionId, key, value);
          if (!result.success) {
            throw new Error(result.error ?? `Failed to save ${key}`);
          }
        }
      }

      // Reload status
      const status = await window.electronAPI.getConfigStatus(extensionId);
      setConfigStatus(status);

      if (status?.isConfigured) {
        onConfigured?.();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  const handleStartOAuth = async () => {
    setError(null);
    setOauthState((prev) => (prev ? { ...prev, status: "connecting" } : null));

    try {
      const result = await window.electronAPI.startOAuthFlow(extensionId);
      if (!result.success) {
        throw new Error(result.error ?? "Failed to start OAuth flow");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start authentication");
      await loadOAuthState();
    }
  };

  const handleDisconnectOAuth = async () => {
    try {
      const result = await window.electronAPI.disconnectOAuth(extensionId);
      if (!result.success) {
        throw new Error(result.error ?? "Failed to disconnect");
      }
      await loadOAuthState();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disconnect");
    }
  };

  if (!isOpen) return null;

  const isConfigComplete = !hasConfig || configStatus?.isConfigured;
  const isOAuthComplete = !hasOAuth || oauthState?.isAuthenticated;
  const isFullyConfigured = isConfigComplete && isOAuthComplete;

  return (
    <>
      {/* Backdrop */}
      <div style={styles.backdrop} onClick={onClose} />

      {/* Modal */}
      <div style={styles.modal} className="card animate-fadeIn">
        {/* Header */}
        <div style={styles.header}>
          <h2 style={styles.title}>Configure {extensionName}</h2>
          <button onClick={onClose} style={styles.closeButton}>
            <CloseIcon />
          </button>
        </div>

        {/* Content */}
        <div style={styles.content}>
          {error && (
            <div style={styles.errorBanner}>
              <ErrorIcon />
              <span>{error}</span>
            </div>
          )}

          {/* Config Fields */}
          {hasConfig && configSchema && (
            <section style={styles.section}>
              <h3 style={styles.sectionTitle}>Configuration</h3>
              <div style={styles.fieldList}>
                {Object.entries(configSchema).map(([key, field]) => (
                  <ConfigFieldInput
                    key={key}
                    field={field}
                    value={configValues[key]}
                    onChange={(value) => handleConfigChange(key, value)}
                    isMissing={configStatus?.missingFields.includes(key)}
                  />
                ))}
              </div>
              <button
                onClick={handleSaveConfig}
                disabled={saving}
                className="btn-primary"
                style={styles.saveButton}
              >
                {saving ? "Saving..." : "Save Configuration"}
              </button>
            </section>
          )}

          {/* OAuth Section */}
          {hasOAuth && (
            <section style={styles.section}>
              <h3 style={styles.sectionTitle}>Authentication</h3>
              <OAuthStatusCard
                state={oauthState}
                onConnect={handleStartOAuth}
                onDisconnect={handleDisconnectOAuth}
              />
            </section>
          )}

          {/* Status Summary */}
          <section style={styles.section}>
            <div style={styles.statusSummary}>
              {isFullyConfigured ? (
                <>
                  <CheckCircleIcon />
                  <span style={styles.statusText}>Extension is fully configured</span>
                </>
              ) : (
                <>
                  <WarningIcon />
                  <span style={styles.statusText}>
                    {!isConfigComplete && !isOAuthComplete
                      ? "Configuration and authentication required"
                      : !isConfigComplete
                        ? "Configuration required"
                        : "Authentication required"}
                  </span>
                </>
              )}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

// Config Field Input Component
interface ConfigFieldInputProps {
  field: ConfigField;
  value: string | number | boolean | undefined;
  onChange: (value: string | number | boolean) => void;
  isMissing?: boolean;
}

function ConfigFieldInput({ field, value, onChange, isMissing }: ConfigFieldInputProps) {
  const renderInput = () => {
    switch (field.type) {
      case "string":
        return (
          <input
            type={field.secret ? "password" : "text"}
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder ?? `Enter ${field.label.toLowerCase()}`}
            style={{
              ...styles.input,
              ...(isMissing ? styles.inputError : {}),
            }}
            minLength={field.minLength}
            maxLength={field.maxLength}
          />
        );

      case "number":
        return (
          <input
            type="number"
            value={(value as number) ?? ""}
            onChange={(e) => onChange(e.target.valueAsNumber || 0)}
            placeholder={field.placeholder ?? `Enter ${field.label.toLowerCase()}`}
            style={{
              ...styles.input,
              ...(isMissing ? styles.inputError : {}),
            }}
            min={field.min}
            max={field.max}
            step={field.step}
          />
        );

      case "boolean":
        return (
          <button
            onClick={() => onChange(!value)}
            style={{
              ...styles.toggle,
              ...(value ? styles.toggleOn : styles.toggleOff),
            }}
            aria-pressed={!!value}
          >
            <span
              style={{
                ...styles.toggleKnob,
                ...(value ? styles.toggleKnobOn : styles.toggleKnobOff),
              }}
            />
          </button>
        );

      case "select":
        return (
          <select
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            style={{
              ...styles.select,
              ...(isMissing ? styles.inputError : {}),
            }}
          >
            <option value="">Select {field.label.toLowerCase()}</option>
            {field.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        );

      default:
        return null;
    }
  };

  return (
    <div style={styles.fieldRow}>
      <div style={styles.fieldHeader}>
        <label style={styles.fieldLabel}>
          {field.label}
          {field.required && <span style={styles.required}>*</span>}
        </label>
        {field.description && <span style={styles.fieldDescription}>{field.description}</span>}
      </div>
      {renderInput()}
    </div>
  );
}

// OAuth Status Card Component
interface OAuthStatusCardProps {
  state: OAuthState | null;
  onConnect: () => void;
  onDisconnect: () => void;
}

function OAuthStatusCard({ state, onConnect, onDisconnect }: OAuthStatusCardProps) {
  const getStatusDisplay = () => {
    if (!state) return { label: "Loading...", color: "var(--text-muted)" };

    switch (state.status) {
      case "connected":
        return { label: "Connected", color: "var(--success)" };
      case "connecting":
        return { label: "Connecting...", color: "var(--accent)" };
      case "expired":
        return { label: "Session Expired", color: "var(--warning)" };
      case "error":
        return { label: "Error", color: "var(--error)" };
      default:
        return { label: "Not Connected", color: "var(--text-muted)" };
    }
  };

  const status = getStatusDisplay();
  const isConnecting = state?.status === "connecting";

  return (
    <div style={styles.oauthCard}>
      <div style={styles.oauthStatus}>
        <span style={{ ...styles.statusDot, backgroundColor: status.color }} />
        <span style={styles.statusLabel}>{status.label}</span>
        {state?.expiresAt && state.status === "connected" && (
          <span style={styles.expiresAt}>
            Expires: {new Date(state.expiresAt).toLocaleString()}
          </span>
        )}
      </div>

      {state?.error && <div style={styles.oauthError}>{state.error}</div>}

      <div style={styles.oauthActions}>
        {state?.isAuthenticated ? (
          <button onClick={onDisconnect} className="btn-secondary" style={styles.oauthButton}>
            Disconnect
          </button>
        ) : (
          <button
            onClick={onConnect}
            disabled={isConnecting}
            className="btn-primary"
            style={styles.oauthButton}
          >
            {isConnecting ? "Opening browser..." : "Connect Account"}
          </button>
        )}
      </div>
    </div>
  );
}

// Icons
function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <polyline points="9 12 12 15 16 10" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" strokeWidth="2">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

// Styles
const styles: Record<string, CSSProperties> = {
  backdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0, 0, 0, 0.6)",
    backdropFilter: "blur(4px)",
    zIndex: 1000,
  },
  modal: {
    position: "fixed",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: "calc(100% - 48px)",
    maxWidth: "420px",
    maxHeight: "calc(100vh - 96px)",
    overflow: "auto",
    zIndex: 1001,
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "20px 24px",
    borderBottom: "1px solid var(--border)",
  },
  title: {
    fontSize: "18px",
    fontWeight: "600",
    color: "var(--text-primary)",
    margin: 0,
  },
  closeButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "32px",
    height: "32px",
    color: "var(--text-muted)",
    borderRadius: "var(--radius-sm)",
    cursor: "pointer",
    background: "transparent",
    border: "none",
    transition: "color var(--transition-fast), background var(--transition-fast)",
  },
  content: {
    padding: "20px 24px 24px",
  },
  section: {
    marginBottom: "24px",
  },
  sectionTitle: {
    fontSize: "12px",
    fontWeight: "600",
    color: "var(--text-dim)",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    margin: "0 0 12px 0",
  },
  errorBanner: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "12px 14px",
    marginBottom: "16px",
    background: "var(--error-dim)",
    border: "1px solid var(--error)",
    borderRadius: "var(--radius-md)",
    fontSize: "13px",
    color: "var(--error)",
  },
  fieldList: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  fieldRow: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  fieldHeader: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  fieldLabel: {
    fontSize: "14px",
    fontWeight: "500",
    color: "var(--text-primary)",
  },
  required: {
    color: "var(--error)",
    marginLeft: "4px",
  },
  fieldDescription: {
    fontSize: "12px",
    color: "var(--text-dim)",
  },
  input: {
    width: "100%",
    padding: "10px 14px",
    fontSize: "14px",
    color: "var(--text-primary)",
    background: "var(--bg-secondary)",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "var(--border)",
    borderRadius: "var(--radius-md)",
    outline: "none",
    transition: "border-color var(--transition-fast)",
    boxSizing: "border-box",
  },
  inputError: {
    borderColor: "var(--error)",
  },
  select: {
    width: "100%",
    padding: "10px 14px",
    fontSize: "14px",
    color: "var(--text-primary)",
    background: "var(--bg-secondary)",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "var(--border)",
    borderRadius: "var(--radius-md)",
    outline: "none",
    cursor: "pointer",
    boxSizing: "border-box",
  },
  toggle: {
    position: "relative",
    width: "44px",
    height: "24px",
    borderRadius: "12px",
    border: "none",
    cursor: "pointer",
    transition: "background var(--transition-fast)",
    flexShrink: 0,
  },
  toggleOn: {
    background: "var(--accent)",
  },
  toggleOff: {
    background: "var(--border)",
  },
  toggleKnob: {
    position: "absolute",
    top: "2px",
    width: "20px",
    height: "20px",
    borderRadius: "50%",
    background: "white",
    transition: "left var(--transition-fast)",
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.2)",
  },
  toggleKnobOn: {
    left: "22px",
  },
  toggleKnobOff: {
    left: "2px",
  },
  saveButton: {
    width: "100%",
    marginTop: "16px",
    padding: "12px 16px",
  },
  oauthCard: {
    padding: "16px",
    background: "var(--bg-secondary)",
    borderRadius: "var(--radius-md)",
    border: "1px solid var(--border)",
  },
  oauthStatus: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "12px",
  },
  statusDot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
  },
  statusLabel: {
    fontSize: "14px",
    fontWeight: "500",
    color: "var(--text-primary)",
  },
  expiresAt: {
    fontSize: "11px",
    color: "var(--text-dim)",
    marginLeft: "auto",
  },
  oauthError: {
    fontSize: "12px",
    color: "var(--error)",
    marginBottom: "12px",
    padding: "8px",
    background: "var(--error-dim)",
    borderRadius: "var(--radius-sm)",
  },
  oauthActions: {
    display: "flex",
    gap: "8px",
  },
  oauthButton: {
    flex: 1,
    padding: "10px 16px",
    fontSize: "13px",
  },
  statusSummary: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "14px 16px",
    background: "var(--bg-secondary)",
    borderRadius: "var(--radius-md)",
  },
  statusText: {
    fontSize: "14px",
    color: "var(--text-primary)",
  },
};
