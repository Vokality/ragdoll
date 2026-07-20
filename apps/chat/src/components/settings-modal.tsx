import { useState, type CSSProperties } from "react";
import { ExtensionConfigModal } from "./extension-config-modal";
import { useTimedConfirm } from "../hooks/use-timed-confirm";
import type {
  CharacterThemeId,
  CharacterVariantId,
  ExtensionInfo,
} from "../../electron/electron-api";
import type { ExtensionManagementService } from "../application/extension-management-service";
import { useExtensionSettings } from "../hooks/use-extension-settings";
import { ModalShell } from "./modal-shell";

type ExtensionSettings = ReturnType<typeof useExtensionSettings>;

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
  const [configModalExtension, setConfigModalExtension] =
    useState<ExtensionInfo | null>(null);
  const extensions = useExtensionSettings(service, isOpen);

  if (!isOpen) return null;

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
    <ModalShell title="Settings" maxWidth={400} onClose={onClose}>
      <ApiKeySection onChangeApiKey={onChangeApiKey} />

      <OptionPickerSection
        title="Theme"
        options={THEMES}
        selectedId={currentTheme}
        onSelect={onThemeChange}
      />

      <OptionPickerSection
        title="Character"
        options={VARIANTS}
        selectedId={currentVariant}
        onSelect={onVariantChange}
      />

      <FeatureTogglesSection extensions={extensions} />

      <IntegrationsSection
        extensions={extensions}
        onConfigure={setConfigModalExtension}
      />

      <ExtensionLibrarySection
        extensions={extensions}
        onConfigure={setConfigModalExtension}
      />

      <DataSection onClearConversation={onClearConversation} />
    </ModalShell>
  );
}

function ApiKeySection({ onChangeApiKey }: { onChangeApiKey: () => void }) {
  const confirm = useTimedConfirm();

  const handleClick = () => {
    if (confirm.isArmed) {
      confirm.disarm();
      onChangeApiKey();
    } else {
      confirm.arm();
    }
  };

  return (
    <section style={styles.section}>
      <h3 style={styles.sectionTitle}>API Key</h3>
      <div style={styles.apiKeyDisplay}>
        <span style={styles.maskedKey}>sk-****...****</span>
        <button
          type="button"
          onClick={handleClick}
          className={confirm.isArmed ? "btn-danger confirm" : "btn-secondary"}
          style={styles.smallButton}
        >
          {confirm.isArmed ? "Sign out?" : "Change Key"}
        </button>
      </div>
      {confirm.isArmed && (
        <p className="animate-fadeIn" style={styles.confirmHint}>
          Changing the key signs you out and returns to setup.
        </p>
      )}
    </section>
  );
}

interface OptionPickerSectionProps<Id extends string> {
  title: string;
  options: ReadonlyArray<{ id: Id; name: string; description: string }>;
  selectedId: Id;
  onSelect: (id: Id) => void;
}

function OptionPickerSection<Id extends string>({
  title,
  options,
  selectedId,
  onSelect,
}: OptionPickerSectionProps<Id>) {
  return (
    <section style={styles.section}>
      <h3 style={styles.sectionTitle}>{title}</h3>
      <div style={styles.optionGrid}>
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onSelect(option.id)}
            className={`option-card${selectedId === option.id ? " selected" : ""}`}
            aria-pressed={selectedId === option.id}
          >
            <span style={styles.optionName}>{option.name}</span>
            <span style={styles.optionDescription}>{option.description}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function FeatureTogglesSection({
  extensions,
}: {
  extensions: ExtensionSettings;
}) {
  if (extensions.builtIn.length === 0) return null;

  const disabled = new Set(extensions.disabled);

  return (
    <section style={styles.section}>
      <h3 style={styles.sectionTitle}>Features</h3>
      <div style={styles.extensionList}>
        {extensions.builtIn.map((extension) => {
          const isDisabled = disabled.has(extension.id);
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
                <span style={styles.extensionDescription}>
                  {extension.description}
                </span>
              </div>
              <button
                type="button"
                onClick={() => canToggle && void extensions.toggle(extension.id)}
                disabled={!canToggle}
                className={`switch${isDisabled ? "" : " on"}`}
                aria-pressed={!isDisabled}
                aria-label={`${isDisabled ? "Enable" : "Disable"} ${extension.name}`}
              >
                <span className="switch-knob" />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function IntegrationsSection({
  extensions,
  onConfigure,
}: {
  extensions: ExtensionSettings;
  onConfigure: (extension: ExtensionInfo) => void;
}) {
  if (extensions.configurable.length === 0) return null;

  return (
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
              type="button"
              onClick={() => onConfigure(extension)}
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
  );
}

function ExtensionLibrarySection({
  extensions,
  onConfigure,
}: {
  extensions: ExtensionSettings;
  onConfigure: (extension: ExtensionInfo) => void;
}) {
  return (
    <section style={styles.section}>
      <div style={styles.sectionHeader}>
        <h3 style={styles.sectionTitle}>Extensions</h3>
        <button
          type="button"
          onClick={() => void extensions.checkUpdates()}
          disabled={extensions.isCheckingUpdates}
          className="btn-secondary"
          style={styles.checkUpdatesButton}
        >
          {extensions.isCheckingUpdates && <span className="spinner-sm" />}
          {extensions.isCheckingUpdates ? "Checking…" : "Check Updates"}
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
          aria-label="Extension GitHub URL"
          style={styles.installInput}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !extensions.isInstalling) {
              void extensions.install();
            }
          }}
        />
        <button
          type="button"
          onClick={() => void extensions.install()}
          disabled={extensions.isInstalling || !extensions.installUrl.trim()}
          className="btn-primary"
          style={styles.installButton}
        >
          {extensions.isInstalling && <span className="spinner-sm" />}
          {extensions.isInstalling ? "Installing…" : "Install"}
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
          {extensions.notice.tone === "error" ? <ErrorIcon /> : <InfoIcon />}
          <span>{extensions.notice.text}</span>
        </div>
      )}

      {extensions.installed.length > 0 ? (
        <div style={styles.extensionList}>
          {extensions.installed.map((ext) => (
            <InstalledExtensionRow
              key={ext.id}
              ext={ext}
              extensions={extensions}
              onConfigure={onConfigure}
            />
          ))}
        </div>
      ) : (
        <div style={styles.emptyState}>
          No extensions installed. Enter a GitHub URL above to install one.
        </div>
      )}
    </section>
  );
}

function InstalledExtensionRow({
  ext,
  extensions,
  onConfigure,
}: {
  ext: ExtensionSettings["installed"][number];
  extensions: ExtensionSettings;
  onConfigure: (extension: ExtensionInfo) => void;
}) {
  const update = extensions.updates.find(
    (entry) => entry.extensionId === ext.id && entry.hasUpdate,
  );
  const isUpdating = extensions.updatingId === ext.id;
  const isUninstalling = extensions.uninstallingId === ext.id;
  // Check if this extension needs configuration
  const extInfo = extensions.available.find((e) => e.id === ext.id);
  const needsConfig = extInfo && (extInfo.hasConfigSchema || extInfo.hasOAuth);

  return (
    <div style={styles.extensionRow}>
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
            type="button"
            onClick={() => onConfigure(extInfo)}
            className="btn-secondary"
            style={styles.actionButton}
            aria-label={`Configure ${ext.name}`}
            title={`Configure ${ext.name}`}
          >
            <SettingsIcon />
          </button>
        )}
        {update && (
          <button
            type="button"
            onClick={() => void extensions.update(ext.id)}
            disabled={isUpdating}
            className="btn-secondary"
            style={styles.updateButton}
          >
            {isUpdating ? <span className="spinner-sm" /> : "Update"}
          </button>
        )}
        <button
          type="button"
          onClick={() => void extensions.uninstall(ext.id)}
          disabled={isUninstalling}
          style={styles.uninstallButton}
        >
          {isUninstalling ? <span className="spinner-sm" /> : "Uninstall"}
        </button>
      </div>
    </div>
  );
}

function DataSection({
  onClearConversation,
}: {
  onClearConversation: () => void;
}) {
  const confirm = useTimedConfirm();

  const handleClick = () => {
    if (confirm.isArmed) {
      onClearConversation();
      confirm.disarm();
    } else {
      confirm.arm();
    }
  };

  return (
    <section style={styles.section}>
      <h3 style={styles.sectionTitle}>Data</h3>
      {confirm.isArmed ? (
        <div className="animate-fadeIn" style={styles.confirmActions}>
          <button
            type="button"
            onClick={handleClick}
            className="btn-danger confirm"
          >
            Confirm Clear
          </button>
          <button
            type="button"
            onClick={confirm.disarm}
            className="btn-secondary"
            style={styles.cancelButton}
          >
            Cancel
          </button>
        </div>
      ) : (
        <button type="button" onClick={handleClick} className="btn-danger">
          Clear Conversation
        </button>
      )}
    </section>
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
      aria-hidden="true"
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
      aria-hidden="true"
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
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  );
}

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
    width: "auto",
    flexShrink: 0,
  },
  confirmHint: {
    marginTop: "8px",
    fontSize: "12px",
    color: "var(--text-muted)",
  },
  optionGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: "10px",
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
  requiredBadge: {
    fontSize: "11px",
    padding: "2px 6px",
    background: "var(--bg-tertiary)",
    borderRadius: "var(--radius-sm)",
    color: "var(--text-dim)",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
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
    background: "var(--accent-dim)",
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
    fontSize: "11px",
    padding: "2px 6px",
    background: "var(--bg-tertiary)",
    borderRadius: "var(--radius-sm)",
    color: "var(--text-dim)",
  },
  updateBadge: {
    display: "inline-block",
    fontSize: "11px",
    padding: "2px 6px",
    marginTop: "4px",
    background: "var(--accent-dim)",
    borderRadius: "var(--radius-sm)",
    color: "var(--accent)",
    fontWeight: "500",
  },
  updateButton: {
    padding: "6px 10px",
    fontSize: "11px",
    background: "var(--accent)",
    color: "var(--bg-primary)",
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
