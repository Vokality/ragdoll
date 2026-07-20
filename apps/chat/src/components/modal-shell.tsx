import {
  useEffect,
  useRef,
  type CSSProperties,
  type ReactNode,
} from "react";

interface ModalShellProps {
  title: string;
  maxWidth: number;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Native <dialog>-based modal: focus trapping, Escape handling, focus
 * restoration, and the backdrop all come from the platform.
 */
export function ModalShell({
  title,
  maxWidth,
  onClose,
  children,
}: ModalShellProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    // Light dismiss (backdrop click) via the platform; React's typings
    // don't include the `closedby` attribute yet.
    dialog.setAttribute("closedby", "any");
    if (!dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="modal-card card"
      style={{ maxWidth }}
      aria-label={title}
      onClose={onClose}
    >
      <div style={styles.header}>
        <h2 style={styles.title}>{title}</h2>
        <button
          type="button"
          onClick={onClose}
          className="icon-btn"
          style={styles.closeButton}
          aria-label={`Close ${title}`}
        >
          <CloseIcon />
        </button>
      </div>
      <div className="modal-body">{children}</div>
    </dialog>
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
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "20px 24px",
    borderBottom: "1px solid var(--border)",
    flexShrink: 0,
  },
  title: {
    fontSize: "17px",
    fontWeight: "600",
    letterSpacing: "-0.01em",
    color: "var(--text-primary)",
    margin: 0,
  },
  closeButton: {
    width: "32px",
    height: "32px",
  },
};
