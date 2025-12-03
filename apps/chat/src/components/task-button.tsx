import { type CSSProperties } from "react";

interface TaskButtonProps {
  activeCount: number;
  onClick: () => void;
}

export function TaskButton({ activeCount, onClick }: TaskButtonProps) {
  if (activeCount === 0) {
    return null;
  }

  return (
    <>
      <style>{`
        @keyframes taskButtonEnter {
          from {
            opacity: 0;
            transform: scale(0.8) translateY(4px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        @keyframes badgePop {
          0% {
            transform: scale(0);
          }
          50% {
            transform: scale(1.2);
          }
          100% {
            transform: scale(1);
          }
        }

        .task-button-animated {
          animation: taskButtonEnter 200ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }

        .task-button-animated:hover {
          color: var(--text-primary);
          background: var(--bg-glass-light);
          border-color: var(--accent);
          transform: translateY(-1px);
        }

        .task-button-animated:active {
          transform: translateY(0) scale(0.98);
        }

        .task-badge-animated {
          animation: badgePop 300ms cubic-bezier(0.34, 1.56, 0.64, 1) 100ms backwards;
        }
      `}</style>
      <button
        onClick={onClick}
        style={styles.button}
        className="task-button-animated"
        aria-label={`${activeCount} active task${activeCount === 1 ? "" : "s"}`}
        title="View tasks"
      >
        <TaskIcon />
        <span style={styles.badge} className="task-badge-animated">
          {activeCount > 99 ? "99+" : activeCount}
        </span>
      </button>
    </>
  );
}

function TaskIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}

const styles: Record<string, CSSProperties> = {
  button: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "40px",
    height: "40px",
    borderRadius: "var(--radius-md)",
    background: "var(--bg-glass)",
    border: "1px solid var(--border)",
    color: "var(--text-muted)",
    cursor: "pointer",
    transition: "color 150ms ease, background 150ms ease, border-color 150ms ease, transform 150ms ease",
    flexShrink: 0,
  },
  badge: {
    position: "absolute",
    top: "-6px",
    right: "-6px",
    minWidth: "20px",
    height: "20px",
    padding: "0 6px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "11px",
    fontWeight: "600",
    color: "var(--bg-primary)",
    backgroundColor: "var(--accent)",
    borderRadius: "10px",
    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.2)",
  },
};
