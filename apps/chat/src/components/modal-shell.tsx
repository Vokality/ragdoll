import { Icon } from "./ui/icons";
import { IconButton } from "./ui/button";
import {
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type ReactNode,
} from "react";

interface ModalShellProps {
  title: string;
  maxWidth: number;
  onClose: () => void;
  children: ReactNode;
  onBack?: () => void;
  closeLabel?: string;
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
  onBack,
  closeLabel,
}: ModalShellProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useLayoutEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, [title]);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousFocus = document.activeElement;
    // Light dismiss (backdrop click) via the platform; React's typings
    // don't include the `closedby` attribute yet.
    dialog.setAttribute("closedby", "any");
    if (!dialog.open) dialog.showModal();
    return () => {
      dialog.close();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="modal-card card"
      style={{ maxWidth }}
      aria-label={title}
      onCancel={(event) => {
        if (onBack) {
          event.preventDefault();
          onBack();
        }
      }}
      onClose={(event) => {
        // Strict Mode can close and reopen the same element before its queued
        // native close event is delivered.
        if (!event.currentTarget.open) onClose();
      }}
    >
      <div style={styles.header}>
        <div
          style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}
        >
          {onBack && (
            <IconButton
              style={styles.closeButton}
              aria-label="Back"
              onClick={onBack}
            >
              <span aria-hidden="true">←</span>
            </IconButton>
          )}
          <h2 ref={headingRef} tabIndex={-1} style={styles.title}>
            {title}
          </h2>
        </div>
        <IconButton
          onClick={onClose}
          style={styles.closeButton}
          aria-label={closeLabel ?? `Close ${title}`}
        >
          <Icon name="close" size={20} />
        </IconButton>
      </div>
      <div className="modal-body">{children}</div>
    </dialog>
  );
}

const styles: Record<string, CSSProperties> = {
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 18px",
    borderBottom: "1px solid var(--border)",
    flexShrink: 0,
  },
  title: {
    minWidth: 0,
    overflowWrap: "anywhere",
    fontSize: "17px",
    fontWeight: "600",
    letterSpacing: "-0.01em",
    color: "var(--text-primary)",
    margin: 0,
  },
  closeButton: {
    flexShrink: 0,
    width: "32px",
    height: "32px",
  },
};
