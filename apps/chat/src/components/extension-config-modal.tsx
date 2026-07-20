import { useId, type CSSProperties } from "react";
import type { ConfigField } from "@vokality/ragdoll-extensions";
import type { OAuthState } from "../../electron/electron-api";
import type { ExtensionManagementService } from "../application/extension-management-service";
import { useExtensionConfiguration } from "../hooks/use-extension-configuration";
import { ModalShell } from "./modal-shell";

interface ExtensionConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  extensionId: string;
  extensionName: string;
  hasOAuth: boolean;
  hasConfig: boolean;
  onConfigured?: () => void;
  service: ExtensionManagementService;
}

export function ExtensionConfigModal({
  isOpen,
  onClose,
  extensionId,
  extensionName,
  hasOAuth,
  hasConfig,
  onConfigured,
  service,
}: ExtensionConfigModalProps) {
  const configuration = useExtensionConfiguration(service, {
    extensionId,
    hasConfig,
    hasOAuth,
    isOpen,
    onConfigured,
  });

  if (!isOpen) return null;

  const missingFields = new Set(configuration.status?.missingFields ?? []);
  const isConfigComplete = !hasConfig || configuration.status?.isConfigured;
  const isOAuthComplete = !hasOAuth || configuration.oauth?.isAuthenticated;
  const isFullyConfigured = isConfigComplete && isOAuthComplete;

  return (
    <ModalShell
      title={`Configure ${extensionName}`}
      maxWidth={420}
      onClose={onClose}
    >
      {configuration.error && (
        <div style={styles.errorBanner}>
          <ErrorIcon />
          <span>{configuration.error}</span>
        </div>
      )}

      {/* Config Fields */}
      {hasConfig && configuration.schema && (
        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>Configuration</h3>
          <div style={styles.fieldList}>
            {Object.entries(configuration.schema).map(([key, field]) => (
              <ConfigFieldInput
                key={key}
                field={field}
                value={configuration.values[key]}
                onChange={(value) => configuration.changeValue(key, value)}
                isMissing={missingFields.has(key)}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => void configuration.save()}
            disabled={configuration.saving}
            className="btn-primary"
            style={styles.saveButton}
          >
            {configuration.saving && <span className="spinner-sm" />}
            {configuration.saving ? "Saving…" : "Save Configuration"}
          </button>
        </section>
      )}

      {/* OAuth Section */}
      {hasOAuth && (
        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>Authentication</h3>
          <OAuthStatusCard
            state={configuration.oauth}
            onConnect={() => void configuration.connect()}
            onDisconnect={() => void configuration.disconnect()}
          />
        </section>
      )}

      {/* Status Summary */}
      <section style={styles.section}>
        <div style={styles.statusSummary}>
          {isFullyConfigured ? (
            <>
              <CheckCircleIcon />
              <span style={styles.statusText}>
                Extension is fully configured
              </span>
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
    </ModalShell>
  );
}

// Config Field Input Component
interface ConfigFieldInputProps {
  field: ConfigField;
  value: string | number | boolean | undefined;
  onChange: (value: string | number | boolean | undefined) => void;
  isMissing?: boolean;
}

function ConfigFieldInput({
  field,
  value,
  onChange,
  isMissing,
}: ConfigFieldInputProps) {
  const inputId = useId();

  const renderInput = () => {
    switch (field.type) {
      case "string":
        return (
          <input
            id={inputId}
            type={field.secret ? "password" : "text"}
            value={typeof value === "string" ? value : ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={
              field.placeholder ?? `Enter ${field.label.toLowerCase()}`
            }
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
            id={inputId}
            type="number"
            value={typeof value === "number" ? value : ""}
            onChange={(e) =>
              onChange(
                Number.isNaN(e.target.valueAsNumber)
                  ? undefined
                  : e.target.valueAsNumber,
              )
            }
            placeholder={
              field.placeholder ?? `Enter ${field.label.toLowerCase()}`
            }
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
            type="button"
            onClick={() => onChange(value !== true)}
            className={`switch${value === true ? " on" : ""}`}
            aria-pressed={value === true}
            aria-label={field.label}
          >
            <span className="switch-knob" />
          </button>
        );

      case "select":
        return (
          <select
            id={inputId}
            value={typeof value === "string" ? value : ""}
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
        <label htmlFor={inputId} style={styles.fieldLabel}>
          {field.label}
          {field.required && <span style={styles.required}>*</span>}
        </label>
        {field.description && (
          <span style={styles.fieldDescription}>{field.description}</span>
        )}
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

function OAuthStatusCard({
  state,
  onConnect,
  onDisconnect,
}: OAuthStatusCardProps) {
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
          <button
            type="button"
            onClick={onDisconnect}
            className="btn-secondary"
            style={styles.oauthButton}
          >
            Disconnect
          </button>
        ) : (
          <button
            type="button"
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
function ErrorIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--success)"
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="9 12 12 15 16 10" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--warning)"
      strokeWidth="2"
    >
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

// Styles
const styles: Record<string, CSSProperties> = {
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
