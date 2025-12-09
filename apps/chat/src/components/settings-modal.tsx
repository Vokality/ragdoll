import { useState, useEffect, type CSSProperties } from "react";
import { ExtensionConfigModal } from "./extension-config-modal";

// Helper to access extension installation APIs (typed loosely to avoid circular type issues)
const extensionAPI = window.electronAPI as typeof window.electronAPI & {
  installExtensionFromGitHub: (repoUrl: string) => Promise<{
    success: boolean;
    extensionId?: string;
    name?: string;
    version?: string;
    error?: string;
    requiresConfiguration?: boolean;
    message?: string;
  }>;
  uninstallExtension: (extensionId: string) => Promise<{ success: boolean; error?: string }>;
  getUserInstalledExtensions: () => Promise<InstalledExtension[]>;
  checkExtensionUpdates: () => Promise<UpdateCheckResult[]>;
  updateExtension: (extensionId: string) => Promise<{
    success: boolean;
    extensionId?: string;
    name?: string;
    version?: string;
    error?: string;
    requiresConfiguration?: boolean;
    message?: string;
  }>;
};

interface BuiltInExtensionInfo {
  id: string;
  name: string;
  description: string;
  canDisable: boolean;
  hasConfigSchema: boolean;
  hasOAuth: boolean;
}

interface InstalledExtension {
  id: string;
  name: string;
  version: string;
  description: string;
  path: string;
  repoUrl: string;
  installedAt: string;
}

interface UpdateCheckResult {
  extensionId: string;
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
  repoUrl: string;
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTheme: string;
  currentVariant: string;
  onThemeChange: (theme: string) => void;
  onVariantChange: (variant: string) => void;
  onClearConversation: () => void;
  onChangeApiKey: () => void;
}

const THEMES = [
  { id: "default", name: "Default", description: "Warm, human-like" },
  { id: "robot", name: "Robot", description: "Metallic, futuristic" },
  { id: "alien", name: "Alien", description: "Green, otherworldly" },
  { id: "monochrome", name: "Monochrome", description: "Classic B&W" },
];

const VARIANTS = [
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
}: SettingsModalProps) {
  const [confirmClear, setConfirmClear] = useState(false);
  const [availableExtensions, setAvailableExtensions] = useState<BuiltInExtensionInfo[]>([]);
  const [disabledExtensions, setDisabledExtensions] = useState<string[]>([]);
  const [pendingChanges, setPendingChanges] = useState(false);
  const [configModalExtension, setConfigModalExtension] = useState<BuiltInExtensionInfo | null>(null);

  // User-installed extensions state
  const [userExtensions, setUserExtensions] = useState<InstalledExtension[]>([]);
  const [extensionUpdates, setExtensionUpdates] = useState<UpdateCheckResult[]>([]);
  const [installUrl, setInstallUrl] = useState("");
  const [isInstalling, setIsInstalling] = useState(false);
  const [installError, setInstallError] = useState<string | null>(null);
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);
  const [updatingExtensionId, setUpdatingExtensionId] = useState<string | null>(null);
  const [uninstallingExtensionId, setUninstallingExtensionId] = useState<string | null>(null);

  // Load extension data when modal opens
  useEffect(() => {
    if (isOpen) {
      loadExtensionData();
    }
  }, [isOpen]);

  const loadExtensionData = async () => {
    try {
      // Use getDiscoveredExtensions to include unconfigured extensions
      const [available, disabled, userInstalled] = await Promise.all([
        window.electronAPI.getDiscoveredExtensions(),
        window.electronAPI.getDisabledExtensions(),
        extensionAPI.getUserInstalledExtensions(),
      ]);
      setAvailableExtensions(available);
      setDisabledExtensions(disabled);
      setUserExtensions(userInstalled);
      setPendingChanges(false);
    } catch (error) {
      console.error("Failed to load extension data:", error);
    }
  };

  const handleInstallExtension = async () => {
    if (!installUrl.trim()) return;

    setIsInstalling(true);
    setInstallError(null);

    try {
      const result = await extensionAPI.installExtensionFromGitHub(installUrl.trim());
      if (result.success) {
        setInstallUrl("");
        setPendingChanges(true);
        await loadExtensionData();
        
        // Show info message if extension requires configuration
        if (result.requiresConfiguration && result.message) {
          setInstallError(result.message);
          // Clear the message after 5 seconds
          setTimeout(() => setInstallError(null), 5000);
        }
      } else {
        setInstallError(result.error || "Installation failed");
      }
    } catch (error) {
      setInstallError(error instanceof Error ? error.message : "Installation failed");
    } finally {
      setIsInstalling(false);
    }
  };

  const handleUninstallExtension = async (extensionId: string) => {
    setUninstallingExtensionId(extensionId);
    try {
      const result = await extensionAPI.uninstallExtension(extensionId);
      if (result.success) {
        setPendingChanges(true);
        await loadExtensionData();
      }
    } catch (error) {
      console.error("Failed to uninstall extension:", error);
    } finally {
      setUninstallingExtensionId(null);
    }
  };

  const handleCheckUpdates = async () => {
    setIsCheckingUpdates(true);
    try {
      const updates = await extensionAPI.checkExtensionUpdates();
      setExtensionUpdates(updates);
    } catch (error) {
      console.error("Failed to check updates:", error);
    } finally {
      setIsCheckingUpdates(false);
    }
  };

  const handleUpdateExtension = async (extensionId: string) => {
    setUpdatingExtensionId(extensionId);
    try {
      const result = await extensionAPI.updateExtension(extensionId);
      if (result.success) {
        setPendingChanges(true);
        await loadExtensionData();
        // Clear the update notification for this extension
        setExtensionUpdates((prev) => prev.filter((u) => u.extensionId !== extensionId));
        
        // Show info message if extension requires configuration
        if (result.requiresConfiguration && result.message) {
          setInstallError(result.message);
          setTimeout(() => setInstallError(null), 5000);
        }
      } else if (result.error) {
        setInstallError(result.error);
      }
    } catch (error) {
      console.error("Failed to update extension:", error);
      setInstallError("Failed to update extension");
    } finally {
      setUpdatingExtensionId(null);
    }
  };

  const getUpdateForExtension = (extensionId: string): UpdateCheckResult | undefined => {
    return extensionUpdates.find((u) => u.extensionId === extensionId && u.hasUpdate);
  };

  const handleExtensionToggle = async (extensionId: string) => {
    const isCurrentlyDisabled = disabledExtensions.includes(extensionId);
    const newDisabled = isCurrentlyDisabled
      ? disabledExtensions.filter((id) => id !== extensionId)
      : [...disabledExtensions, extensionId];

    setDisabledExtensions(newDisabled);

    try {
      const result = await window.electronAPI.setDisabledExtensions(newDisabled);
      if (result.requiresRestart) {
        setPendingChanges(true);
      }
    } catch (error) {
      console.error("Failed to save extension settings:", error);
      // Revert on error
      setDisabledExtensions(disabledExtensions);
    }
  };

  if (!isOpen) return null;

  const handleClearConversation = () => {
    if (confirmClear) {
      onClearConversation();
      setConfirmClear(false);
    } else {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 3000);
    }
  };

  // Filter out user-installed extensions from built-in sections
  const userExtensionIds = new Set(userExtensions.map(ext => ext.id));
  const builtInExtensions = availableExtensions.filter(ext => !userExtensionIds.has(ext.id));

  // Show all built-in extensions in Features section (all will be visible, toggles disabled for core ones)
  const featureExtensions = builtInExtensions;

  // Filter to show extensions that need configuration (OAuth or Config)
  const configurableExtensions = builtInExtensions.filter(
    (ext) => ext.hasConfigSchema || ext.hasOAuth
  );

  // If config modal is open, render only that
  if (configModalExtension) {
    return (
      <ExtensionConfigModal
        isOpen={true}
        onClose={() => setConfigModalExtension(null)}
        extensionId={configModalExtension.id}
        extensionName={configModalExtension.name}
        hasOAuth={configModalExtension.hasOAuth}
        hasConfig={configModalExtension.hasConfigSchema}
        onConfigured={() => {
          setPendingChanges(true);
          loadExtensionData(); // Reload extension data after configuration
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
              <button onClick={onChangeApiKey} className="btn-secondary" style={styles.smallButton}>
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
                  <span style={styles.optionDescription}>{theme.description}</span>
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
                    ...(currentVariant === variant.id ? styles.optionSelected : {}),
                  }}
                >
                  <span style={styles.optionName}>{variant.name}</span>
                  <span style={styles.optionDescription}>{variant.description}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Features Section - Show all built-in extensions */}
          {featureExtensions.length > 0 && (
            <section style={styles.section}>
              <h3 style={styles.sectionTitle}>Features</h3>
              {pendingChanges && (
                <div style={styles.restartNotice}>
                  <InfoIcon />
                  <span>Restart the app to apply changes</span>
                </div>
              )}
              <div style={styles.extensionList}>
                {featureExtensions.map((extension) => {
                  const isDisabled = disabledExtensions.includes(extension.id);
                  const canToggle = extension.canDisable;
                  return (
                    <div key={extension.id} style={styles.extensionRow}>
                      <div style={styles.extensionInfo}>
                        <div style={styles.extensionNameRow}>
                          <span style={styles.extensionName}>{extension.name}</span>
                          {!canToggle && (
                            <span style={styles.requiredBadge}>Required</span>
                          )}
                        </div>
                        <span style={styles.extensionDescription}>{extension.description}</span>
                      </div>
                      <button
                        onClick={() => canToggle && handleExtensionToggle(extension.id)}
                        disabled={!canToggle}
                        style={{
                          ...styles.toggle,
                          ...(canToggle 
                            ? (isDisabled ? styles.toggleOff : styles.toggleOn)
                            : styles.toggleDisabled),
                        }}
                        aria-pressed={!isDisabled}
                        aria-label={`${isDisabled ? "Enable" : "Disable"} ${extension.name}`}
                      >
                        <span
                          style={{
                            ...styles.toggleKnob,
                            ...(canToggle
                              ? (isDisabled ? styles.toggleKnobOff : styles.toggleKnobOn)
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
          {configurableExtensions.length > 0 && (
            <section style={styles.section}>
              <h3 style={styles.sectionTitle}>Integrations</h3>
              <div style={styles.extensionList}>
                {configurableExtensions.map((extension) => (
                  <div key={extension.id} style={styles.extensionRow}>
                    <div style={styles.extensionInfo}>
                      <span style={styles.extensionName}>{extension.name}</span>
                      <span style={styles.extensionDescription}>{extension.description}</span>
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
                onClick={handleCheckUpdates}
                disabled={isCheckingUpdates}
                className="btn-secondary"
                style={styles.checkUpdatesButton}
              >
                {isCheckingUpdates ? "Checking..." : "Check Updates"}
              </button>
            </div>

            {/* Install new extension */}
            <div style={styles.installSection}>
              <input
                type="text"
                value={installUrl}
                onChange={(e) => {
                  setInstallUrl(e.target.value);
                  setInstallError(null);
                }}
                placeholder="GitHub URL (e.g., github.com/owner/repo)"
                style={styles.installInput}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !isInstalling) {
                    handleInstallExtension();
                  }
                }}
              />
              <button
                onClick={handleInstallExtension}
                disabled={isInstalling || !installUrl.trim()}
                className="btn-primary"
                style={styles.installButton}
              >
                {isInstalling ? "Installing..." : "Install"}
              </button>
            </div>
            {installError && (
              <div style={styles.installError}>
                <ErrorIcon />
                <span>{installError}</span>
              </div>
            )}

            {/* List of user-installed extensions */}
            {userExtensions.length > 0 && (
              <div style={styles.extensionList}>
                {userExtensions.map((ext) => {
                  const update = getUpdateForExtension(ext.id);
                  const isUpdating = updatingExtensionId === ext.id;
                  const isUninstalling = uninstallingExtensionId === ext.id;
                  // Check if this extension needs configuration
                  const extInfo = availableExtensions.find(e => e.id === ext.id);
                  const needsConfig = extInfo && (extInfo.hasConfigSchema || extInfo.hasOAuth);
                  
                  return (
                    <div key={ext.id} style={styles.extensionRow}>
                      <div style={styles.extensionInfo}>
                        <div style={styles.extensionNameRow}>
                          <span style={styles.extensionName}>{ext.name}</span>
                          <span style={styles.versionBadge}>v{ext.version}</span>
                        </div>
                        <span style={styles.extensionDescription}>{ext.description}</span>
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
                            onClick={() => handleUpdateExtension(ext.id)}
                            disabled={isUpdating}
                            className="btn-secondary"
                            style={styles.updateButton}
                          >
                            {isUpdating ? "..." : "Update"}
                          </button>
                        )}
                        <button
                          onClick={() => handleUninstallExtension(ext.id)}
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

            {userExtensions.length === 0 && (
              <div style={styles.emptyState}>
                No extensions installed. Enter a GitHub URL above to install one.
              </div>
            )}
          </section>

          {/* Danger Zone */}
          <section style={styles.section}>
            <h3 style={styles.sectionTitle}>Data</h3>
            <button
              onClick={handleClearConversation}
              style={{
                ...styles.dangerButton,
                ...(confirmClear ? styles.dangerButtonConfirm : {}),
              }}
            >
              {confirmClear ? "Click again to confirm" : "Clear Conversation"}
            </button>
          </section>
        </div>
      </div>
    </>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
    transition: "border-color var(--transition-fast), background var(--transition-fast)",
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
  // Extension toggle styles
  restartNotice: {
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
