import { useState, type CSSProperties } from "react";
import { ExtensionConfigModal } from "./extension-config-modal";
import type {
  CharacterThemeId,
  CharacterVariantId,
  ExtensionInfo,
} from "../../electron/electron-api";
import type { ExtensionManagementService } from "../application/extension-management-service";
import { useExtensionSettings } from "../hooks/use-extension-settings";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTheme: CharacterThemeId;
  currentVariant: CharacterVariantId;
  onThemeChange: (theme: CharacterThemeId) => void;
  onVariantChange: (variant: CharacterVariantId) => void;
  onClearConversation: () => void;
  onChangeApiKey: () => void;
  service: ExtensionManagementService;
}

const THEMES: ReadonlyArray<{
  id: CharacterThemeId;
  name: string;
  description: string;
}> = [
  { id: "default", name: "Default", description: "Warm, human-like" },
  { id: "robot", name: "Robot", description: "Metallic, futuristic" },
  { id: "alien", name: "Alien", description: "Green, otherworldly" },
  { id: "monochrome", name: "Monochrome", description: "Classic B&W" },
];

const VARIANTS: ReadonlyArray<{
  id: CharacterVariantId;
  name: string;
  description: string;
}> = [
  { id: "human", name: "Human", description: "Balanced proportions" },
  { id: "einstein", name: "Einstein", description: "Wild hair & mustache" },
];

export function SettingsModal({
  isOpen,
  onClose,
  currentTheme,
  currentVariant,
  onThemeChange,
  onVariantChange,
  onClearConversation,
  onChangeApiKey,
  service,
}: SettingsModalProps) {
  const [confirmClear, setConfirmClear] = useState(false);
  const [configModalExtension, setConfigModalExtension] =
    useState<ExtensionInfo | null>(null);
  const extensions = useExtensionSettings(service, isOpen);

  if (!isOpen) return null;

  const handleClearConversation = () => {
    if (confirmClear) {
      onClearConversation();
      setConfirmClear(false);
    } else {
      setConfirmClear(true);
    }
  };

  // If config modal is open, render only that
  if (configModalExtension) {
    return (
      <ExtensionConfigModal
        service={service}
        isOpen={true}
        onClose={() => setConfigModalExtension(null)}
        extensionId={configModalExtension.id}
        extensionName={configModalExtension.name}
        hasOAuth={configModalExtension.hasOAuth}
        hasConfig={configModalExtension.hasConfigSchema}
        onConfigured={() => {
          void extensions.refresh();
        }}
      />
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div style={styles.backdrop} onClick={onClose} />

      {/* Modal */}
      <div style={styles.modal} className="card animate-fadeIn">
        {/* Header */}
        <div style={styles.header}>
          <h2 style={styles.title}>Settings</h2>
          <button onClick={onClose} style={styles.closeButton}>
            <CloseIcon />
          </button>
        </div>

        {/* Content */}
        <div style={styles.content}>
          {/* API Key Section */}
          <section style={styles.section}>
            <h3 style={styles.sectionTitle}>API Key</h3>
            <div style={styles.apiKeyDisplay}>
              <span style={styles.maskedKey}>sk-****...****</span>
              <button
                onClick={onChangeApiKey}
                className="btn-secondary"
                style={styles.smallButton}
              >
                Change Key
              </button>
            </div>
          </section>

          {/* Theme Section */}
          <section style={styles.section}>
            <h3 style={styles.sectionTitle}>Theme</h3>
            <div style={styles.optionGrid}>
              {THEMES.map((theme) => (
                <button
                  key={theme.id}
                  onClick={() => onThemeChange(theme.id)}
                  style={{
                    ...styles.optionButton,
                    ...(currentTheme === theme.id ? styles.optionSelected : {}),
                  }}
                >
                  <span style={styles.optionName}>{theme.name}</span>
                  <span style={styles.optionDescription}>
                    {theme.description}
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* Variant Section */}
          <section style={styles.section}>
            <h3 style={styles.sectionTitle}>Character</h3>
            <div style={styles.optionGrid}>
              {VARIANTS.map((variant) => (
                <button
                  key={variant.id}
                  onClick={() => onVariantChange(variant.id)}
                  style={{
                    ...styles.optionButton,
                    ...(currentVariant === variant.id
                      ? styles.optionSelected
                      : {}),
                  }}
                >
                  <span style={styles.optionName}>{variant.name}</span>
                  <span style={styles.optionDescription}>
                    {variant.description}
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* Features Section - Show all built-in extensions */}
          {extensions.builtIn.length > 0 && (
            <section style={styles.section}>
              <h3 style={styles.sectionTitle}>Features</h3>
              <div style={styles.extensionList}>
                {extensions.builtIn.map((extension) => {
                  const isDisabled = extensions.disabled.includes(extension.id);
                  const canToggle = extension.canDisable;
                  return (
                    <div key={extension.id} style={styles.extensionRow}>
                      <div style={styles.extensionInfo}>
                        <div style={styles.extensionNameRow}>
                          <span style={styles.extensionName}>
                            {extension.name}
                          </span>
                          {!canToggle && (
                            <span style={styles.requiredBadge}>Required</span>
                          )}
                        </div>
                        <span style={styles.extensionDescription}>
                          {extension.description}
                        </span>
                      </div>
                      <button
                        onClick={() =>
                          canToggle && void extensions.toggle(extension.id)
                        }
                        disabled={!canToggle}
                        style={{
                          ...styles.toggle,
                          ...(canToggle
                            ? isDisabled
                              ? styles.toggleOff
                              : styles.toggleOn
                            : styles.toggleDisabled),
                        }}
                        aria-pressed={!isDisabled}
                        aria-label={`${isDisabled ? "Enable" : "Disable"} ${extension.name}`}
                      >
                        <span
                          style={{
                            ...styles.toggleKnob,
                            ...(canToggle
                              ? isDisabled
                                ? styles.toggleKnobOff
                                : styles.toggleKnobOn
                              : styles.toggleKnobDisabled),
                          }}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Configurable Extensions Section */}
          {extensions.configurable.length > 0 && (
            <section style={styles.section}>
              <h3 style={styles.sectionTitle}>Integrations</h3>
              <div style={styles.extensionList}>
                {extensions.configurable.map((extension) => (
                  <div key={extension.id} style={styles.extensionRow}>
                    <div style={styles.extensionInfo}>
                      <span style={styles.extensionName}>{extension.name}</span>
                      <span style={styles.extensionDescription}>
                        {extension.description}
                      </span>
                    </div>
                    <button
                      onClick={() => setConfigModalExtension(extension)}
                      className="btn-secondary"
                      style={styles.configButton}
                    >
                      <SettingsIcon />
                      Configure
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* User-Installed Extensions Section */}
          <section style={styles.section}>
            <div style={styles.sectionHeader}>
              <h3 style={styles.sectionTitle}>Extensions</h3>
              <button
                onClick={() => void extensions.checkUpdates()}
                disabled={extensions.isCheckingUpdates}
                className="btn-secondary"
                style={styles.checkUpdatesButton}
              >
                {extensions.isCheckingUpdates ? "Checking..." : "Check Updates"}
              </button>
            </div>

            {/* Install new extension */}
            <div style={styles.installSection}>
              <input
                type="text"
                value={extensions.installUrl}
                onChange={(e) => {
                  extensions.setInstallUrl(e.target.value);
                }}
                placeholder="GitHub URL (e.g., github.com/owner/repo)"
                style={styles.installInput}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !extensions.isInstalling) {
                    void extensions.install();
                  }
                }}
              />
              <button
                onClick={() => void extensions.install()}
                disabled={
                  extensions.isInstalling || !extensions.installUrl.trim()
                }
                className="btn-primary"
                style={styles.installButton}
              >
                {extensions.isInstalling ? "Installing..." : "Install"}
              </button>
            </div>
            {extensions.notice && (
              <div
                style={
                  extensions.notice.tone === "error"
                    ? styles.installError
                    : styles.installNotice
                }
              >
                {extensions.notice.tone === "error" ? (
                  <ErrorIcon />
                ) : (
                  <InfoIcon />
                )}
                <span>{extensions.notice.text}</span>
              </div>
            )}

            {/* List of user-installed extensions */}
            {extensions.installed.length > 0 && (
              <div style={styles.extensionList}>
                {extensions.installed.map((ext) => {
                  const update = extensions.updates.find(
                    (entry) => entry.extensionId === ext.id && entry.hasUpdate,
                  );
                  const isUpdating = extensions.updatingId === ext.id;
                  const isUninstalling = extensions.uninstallingId === ext.id;
                  // Check if this extension needs configuration
                  const extInfo = extensions.available.find(
                    (e) => e.id === ext.id,
                  );
                  const needsConfig =
                    extInfo && (extInfo.hasConfigSchema || extInfo.hasOAuth);

                  return (
                    <div key={ext.id} style={styles.extensionRow}>
                      <div style={styles.extensionInfo}>
                        <div style={styles.extensionNameRow}>
                          <span style={styles.extensionName}>{ext.name}</span>
                          <span style={styles.versionBadge}>
                            v{ext.version}
                          </span>
                        </div>
                        <span style={styles.extensionDescription}>
                          {ext.description}
                        </span>
                        {update && (
                          <span style={styles.updateBadge}>
                            v{update.latestVersion} available
                          </span>
                        )}
                      </div>
                      <div style={styles.extensionActions}>
                        {needsConfig && extInfo && (
                          <button
                            onClick={() => setConfigModalExtension(extInfo)}
                            className="btn-secondary"
                            style={styles.actionButton}
                          >
                            <SettingsIcon />
                          </button>
                        )}
                        {update && (
                          <button
                            onClick={() => void extensions.update(ext.id)}
                            disabled={isUpdating}
                            className="btn-secondary"
                            style={styles.updateButton}
                          >
                            {isUpdating ? "..." : "Update"}
                          </button>
                        )}
                        <button
                          onClick={() => void extensions.uninstall(ext.id)}
                          disabled={isUninstalling}
                          style={styles.uninstallButton}
                        >
                          {isUninstalling ? "..." : "Uninstall"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {extensions.installed.length === 0 && (
              <div style={styles.emptyState}>
                No extensions installed. Enter a GitHub URL above to install
                one.
              </div>
            )}
          </section>

          {/* Danger Zone */}
          <section style={styles.section}>
            <h3 style={styles.sectionTitle}>Data</h3>
            {confirmClear ? (
              <div style={styles.confirmActions}>
                <button
                  onClick={handleClearConversation}
                  style={{
                    ...styles.dangerButton,
                    ...styles.dangerButtonConfirm,
                  }}
                >
                  Confirm Clear
                </button>
                <button
                  onClick={() => setConfirmClear(false)}
                  className="btn-secondary"
                  style={styles.cancelButton}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={handleClearConversation}
                style={styles.dangerButton}
              >
                Clear Conversation
              </button>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

function CloseIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg
      width="14"
      height="14"
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
    maxWidth: "400px",
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
    transition:
      "color var(--transition-fast), background var(--transition-fast)",
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
  apiKeyDisplay: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
  },
  maskedKey: {
    fontFamily: "var(--font-mono)",
    fontSize: "13px",
    color: "var(--text-muted)",
    padding: "10px 14px",
    background: "var(--bg-secondary)",
    borderRadius: "var(--radius-sm)",
    flex: 1,
  },
  smallButton: {
    padding: "10px 16px",
    fontSize: "13px",
  },
  optionGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: "10px",
  },
  optionButton: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "2px",
    padding: "12px 14px",
    background: "var(--bg-secondary)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)",
    cursor: "pointer",
    textAlign: "left",
    transition:
      "border-color var(--transition-fast), background var(--transition-fast)",
  },
  optionSelected: {
    borderColor: "var(--accent)",
    background: "rgba(90, 155, 196, 0.1)",
  },
  optionName: {
    fontSize: "14px",
    fontWeight: "500",
    color: "var(--text-primary)",
  },
  optionDescription: {
    fontSize: "11px",
    color: "var(--text-dim)",
  },
  extensionList: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  extensionRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    padding: "12px 14px",
    background: "var(--bg-secondary)",
    borderRadius: "var(--radius-md)",
  },
  extensionInfo: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    flex: 1,
    minWidth: 0,
  },
  extensionName: {
    fontSize: "14px",
    fontWeight: "500",
    color: "var(--text-primary)",
  },
  extensionDescription: {
    fontSize: "11px",
    color: "var(--text-dim)",
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
  toggleDisabled: {
    background: "var(--bg-tertiary)",
    cursor: "not-allowed",
    opacity: 0.5,
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
  toggleKnobDisabled: {
    left: "22px",
    opacity: 0.6,
  },
  requiredBadge: {
    fontSize: "10px",
    padding: "2px 6px",
    background: "var(--bg-tertiary)",
    borderRadius: "var(--radius-sm)",
    color: "var(--text-dim)",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  dangerButton: {
    width: "100%",
    padding: "12px 16px",
    fontSize: "13px",
    color: "var(--error)",
    background: "var(--error-dim)",
    border: "1px solid var(--error)",
    borderRadius: "var(--radius-md)",
    cursor: "pointer",
    transition: "background var(--transition-fast)",
  },
  dangerButtonConfirm: {
    background: "var(--error)",
    color: "white",
  },
  confirmActions: {
    display: "flex",
    gap: "8px",
  },
  cancelButton: {
    width: "100%",
  },
  configButton: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: "8px 12px",
    fontSize: "12px",
    flexShrink: 0,
  },
  // Extension installation styles
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "12px",
  },
  checkUpdatesButton: {
    padding: "6px 10px",
    fontSize: "11px",
  },
  installSection: {
    display: "flex",
    gap: "8px",
    marginBottom: "12px",
  },
  installInput: {
    flex: 1,
    padding: "10px 12px",
    fontSize: "13px",
    color: "var(--text-primary)",
    background: "var(--bg-secondary)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)",
    outline: "none",
  },
  installButton: {
    padding: "10px 16px",
    fontSize: "13px",
    flexShrink: 0,
  },
  installError: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px 12px",
    marginBottom: "12px",
    background: "var(--error-dim)",
    border: "1px solid var(--error)",
    borderRadius: "var(--radius-sm)",
    fontSize: "12px",
    color: "var(--error)",
  },
  installNotice: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px 12px",
    marginBottom: "12px",
    background: "rgba(90, 155, 196, 0.1)",
    border: "1px solid var(--accent)",
    borderRadius: "var(--radius-sm)",
    fontSize: "12px",
    color: "var(--accent)",
  },
  extensionNameRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
  },
  versionBadge: {
    fontSize: "10px",
    padding: "2px 6px",
    background: "var(--bg-tertiary)",
    borderRadius: "var(--radius-sm)",
    color: "var(--text-dim)",
  },
  updateBadge: {
    display: "inline-block",
    fontSize: "10px",
    padding: "2px 6px",
    marginTop: "4px",
    background: "rgba(90, 155, 196, 0.2)",
    borderRadius: "var(--radius-sm)",
    color: "var(--accent)",
    fontWeight: "500",
  },
  updateButton: {
    padding: "6px 10px",
    fontSize: "11px",
    background: "var(--accent)",
    color: "white",
    border: "none",
    borderRadius: "var(--radius-sm)",
    cursor: "pointer",
  },
  extensionActions: {
    display: "flex",
    gap: "6px",
    flexShrink: 0,
  },
  actionButton: {
    padding: "6px 10px",
    fontSize: "11px",
  },
  uninstallButton: {
    padding: "6px 10px",
    fontSize: "11px",
    color: "var(--error)",
    background: "transparent",
    border: "1px solid var(--error)",
    borderRadius: "var(--radius-sm)",
    cursor: "pointer",
  },
  emptyState: {
    padding: "16px",
    textAlign: "center",
    fontSize: "13px",
    color: "var(--text-dim)",
    background: "var(--bg-secondary)",
    borderRadius: "var(--radius-md)",
  },
};
