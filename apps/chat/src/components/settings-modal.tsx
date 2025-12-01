import { useState, type CSSProperties } from "react";

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
};

