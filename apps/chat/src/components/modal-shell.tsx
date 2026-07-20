import type { CSSProperties, ReactNode } from "react";

interface ModalShellProps {
  title: string;
  maxWidth: number;
  onClose: () => void;
  children: ReactNode;
}

export function ModalShell({
  title,
  maxWidth,
  onClose,
  children,
}: ModalShellProps) {
  return (
    <>
      <div style={styles.backdrop} onClick={onClose} aria-hidden="true" />
      <div
        style={{ ...styles.modal, maxWidth }}
        className="card animate-fadeIn"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div style={styles.header}>
          <h2 style={styles.title}>{title}</h2>
          <button
            onClick={onClose}
            style={styles.closeButton}
            aria-label={`Close ${title}`}
          >
            <CloseIcon />
          </button>
        </div>
        <div style={styles.content}>{children}</div>
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
      aria-hidden="true"
    >
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
    transition:
      "color var(--transition-fast), background var(--transition-fast)",
  },
  content: {
    padding: "20px 24px 24px",
  },
};
