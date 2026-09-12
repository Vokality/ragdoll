import { XIcon } from "@phosphor-icons/react/dist/csr/X";
import { CheckIcon as CheckGlyph } from "@phosphor-icons/react/dist/csr/Check";
/**
 * SlotPanel - Renders an extension UI slot's panel as a bottom sheet.
 *
 * Supports serializable list-based panels with items, sections, and actions.
 */

import {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react";
import { CanvasPanel } from "./canvas-panel.js";
import { downloadCanvasSvg } from "./download-canvas.js";
import { usePanelAction } from "./use-panel-action.js";
import { useSlotState } from "./hooks.js";
import type {
  SlotPanelProps,
  PanelConfig,
  PanelFrame,
  ListPanelConfig,
  GridPanelConfig,
  CardsPanelConfig,
  DocumentPanelConfig,
  CardsPanelResult,
  GridPanelCell,
  GridPanelResult,
  ListPanelItem,
  ListPanelSection,
  PanelAction,
  ItemStatus,
} from "./types.js";

// =============================================================================
// Animation Constants
// =============================================================================

const ANIMATION_DURATION = 250;

// =============================================================================
// Main SlotPanel Component
// =============================================================================

/**
 * Panel component for an extension UI slot.
 *
 * Renders as a bottom sheet with the slot's panel configuration.
 * The panel contract is serializable so it can cross process boundaries.
 */
export function SlotPanel({ slot, onClose }: SlotPanelProps) {
  const state = useSlotState(slot);

  return <SlotPanelBase isOpen={true} onClose={onClose} panel={state.panel} />;
}

/** Panel content for hosts that place extension controls inside their own layout. */
export function InlineSlotPanel({ slot, onClose }: SlotPanelProps) {
  const state = useSlotState(slot);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented || event.isComposing)
        return;
      if (document.querySelector("dialog[open]")) return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);
  return (
    <section
      className="inline-slot-panel"
      aria-label={state.panel.title}
      onKeyDown={(event) => {
        if (event.key === "Escape" && !event.defaultPrevented) {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <style>{panelStyles}</style>
      <PanelContent panel={state.panel} onClose={onClose} />
    </section>
  );
}

function PanelContent({
  panel,
  onClose,
}: {
  panel: PanelConfig;
  onClose: () => void;
}) {
  switch (panel.type) {
    case "canvas":
      return (
        <PanelLayout
          panel={panel}
          onClose={onClose}
          input={
            <ActionButton
              action={{
                id: "export-svg",
                label: "Export SVG",
                onClick: () => downloadCanvasSvg(panel.document),
              }}
            />
          }
        >
          <CanvasPanel document={panel.document} />
        </PanelLayout>
      );
    case "document":
      return <DocumentPanel config={panel} onClose={onClose} />;
    case "list":
      return <ListPanel config={panel} onClose={onClose} />;
    case "grid":
      return <GridPanel config={panel} onClose={onClose} />;
    case "cards":
      return (
        <CardsPanel
          key={panel.card.attemptId}
          config={panel}
          onClose={onClose}
        />
      );
  }
}

/** One layout owns all fixed regions; renderers contribute only body and input. */
function PanelLayout({
  panel,
  onClose,
  children,
  input,
  pending = false,
}: {
  panel: PanelFrame;
  onClose: () => void;
  children: ReactNode;
  input?: ReactNode;
  pending?: boolean;
}) {
  const progress = panel.progress;
  return (
    <>
      <header className="slot-panel-header" style={styles.header}>
        <div className="slot-panel-heading">
          <h2 style={styles.title}>{panel.title}</h2>
          {panel.status && (
            <span
              className={`slot-panel-status slot-panel-status-${panel.status.tone ?? "default"}`}
              role="status"
            >
              {panel.status.label}
            </span>
          )}
          {progress && (
            <div
              className="slot-panel-progress"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={progress.total}
              aria-valuenow={progress.current}
              aria-label={progress.label ?? "Progress"}
            >
              <span>
                {progress.label ?? "Progress"} · {progress.current}/
                {progress.total}
              </span>
              <span className="slot-panel-progress-track">
                <span
                  style={{
                    width: `${progress.total > 0 ? Math.min(100, Math.max(0, (progress.current / progress.total) * 100)) : 0}%`,
                  }}
                />
              </span>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          style={styles.closeButton}
          className="slot-panel-close"
          aria-label="Close"
        >
          <CloseIcon />
        </button>
      </header>
      {children}
      {(input || !!panel.actions?.length) && (
        <footer className="slot-panel-footer" aria-label="Panel controls">
          {input}
          {panel.actions?.map((action) => (
            <ActionButton
              key={action.id}
              action={action}
              forceDisabled={pending}
            />
          ))}
        </footer>
      )}
    </>
  );
}

// =============================================================================
// Base Panel Component (for direct use without slot)
// =============================================================================

interface SlotPanelBaseProps {
  isOpen: boolean;
  onClose: () => void;
  panel: PanelConfig;
}

/**
 * Base panel component that can be used directly with a panel config.
 */
export function SlotPanelBase({ isOpen, onClose, panel }: SlotPanelBaseProps) {
  const [mounted, setMounted] = useState(isOpen);
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Mount immediately when opened; keep rendering through the exit animation.
  if (isOpen && !mounted) {
    setMounted(true);
  }

  useEffect(() => {
    if (isOpen || !mounted) return;
    const timer = setTimeout(() => {
      setMounted(false);
    }, ANIMATION_DURATION);
    return () => clearTimeout(timer);
  }, [isOpen, mounted]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!mounted || !dialog) return;
    const previousFocus = document.activeElement;
    dialog.setAttribute("closedby", "any");
    dialog.showModal();
    return () => {
      dialog.close();
      // React may detach the dialog before cleanup, bypassing the browser's
      // normal close-time focus restoration.
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, [mounted]);

  if (!mounted) {
    return null;
  }

  const isExiting = !isOpen;

  return (
    <>
      <style>{panelStyles}</style>

      {/* Sheet */}
      <dialog
        ref={dialogRef}
        className={`slot-panel-sheet ${panel.type === "grid" ? "slot-panel-sheet-grid" : ""} ${panel.type === "cards" ? "slot-panel-sheet-cards" : ""} ${isExiting ? "exiting" : ""}`}
        aria-label={panel.title}
        onCancel={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (isOpen) handleClose();
        }}
      >
        {/* Handle */}
        <div style={styles.handleWrapper}>
          <div style={styles.handle} />
        </div>

        <PanelContent panel={panel} onClose={handleClose} />
      </dialog>
    </>
  );
}

// =============================================================================
// Document Panel Renderer
// =============================================================================

interface DocumentPanelProps {
  config: DocumentPanelConfig;
  onClose: () => void;
}

function DocumentPanel({ config, onClose }: DocumentPanelProps) {
  const hasBody = config.body.length > 0;
  return (
    <PanelLayout panel={config} onClose={onClose}>
      <div
        className="slot-panel-body slot-panel-document-content"
        style={styles.content}
      >
        {hasBody ? (
          <article
            className="slot-panel-document-body"
            style={styles.documentBody}
            aria-label={config.title}
          >
            {config.body}
          </article>
        ) : (
          <div style={styles.emptyState}>
            <p style={styles.emptyText}>
              {config.emptyMessage ?? "No note yet"}
            </p>
          </div>
        )}
      </div>
    </PanelLayout>
  );
}

// =============================================================================
// Cards Panel Renderer
// =============================================================================

interface CardsPanelProps {
  config: CardsPanelConfig;
  onClose: () => void;
}

function useCardAnswer(config: CardsPanelConfig) {
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);
  const canSubmit =
    config.card.face === "front" &&
    typeof config.onSubmitAnswer === "function" &&
    config.answerInput?.disabled !== true &&
    !pending;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit || !config.onSubmitAnswer || submitting.current) return;
    const answer = draft.trim();
    if (!answer) return;
    submitting.current = true;
    setPending(true);
    setError("");
    try {
      await config.onSubmitAnswer(answer);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      submitting.current = false;
      setPending(false);
    }
  };
  return { draft, setDraft, pending, error, canSubmit, handleSubmit };
}

// Keyed by attemptId in PanelContent: late results only update their own attempt.
function CardsPanel({ config, onClose }: CardsPanelProps) {
  const { card } = config;
  const { draft, setDraft, pending, error, canSubmit, handleSubmit } =
    useCardAnswer(config);

  return (
    <PanelLayout
      panel={config}
      onClose={onClose}
      pending={pending}
      input={
        card.face === "front" && config.answerInput ? (
          <form style={styles.answerForm} onSubmit={handleSubmit}>
            <input
              type="text"
              value={draft}
              onChange={(event) => {
                setDraft(event.currentTarget.value);
              }}
              placeholder={config.answerInput.placeholder ?? "Type your answer"}
              maxLength={config.answerInput.maxLength}
              disabled={!canSubmit}
              style={styles.answerInput}
              className="slot-panel-answer-input"
              aria-label="Answer"
              autoComplete="off"
            />
            <button
              type="submit"
              disabled={!canSubmit || draft.trim().length === 0}
              style={{
                ...styles.actionButton,
                ...getActionVariantStyle("primary"),
                flex: "0 0 auto",
              }}
              className="slot-panel-action"
            >
              {config.answerInput.submitLabel ?? "Check"}
            </button>
          </form>
        ) : null
      }
    >
      <div
        className="slot-panel-body slot-panel-cards-content"
        style={styles.cardsContent}
      >
        {error ? <p role="alert">{error}</p> : null}
        <div
          key={card.attemptId}
          className={`slot-panel-flip-scene ${card.face === "back" ? "flipped" : ""}`}
          style={styles.flipScene}
        >
          <div className="slot-panel-flip-card" style={styles.flipCard}>
            <div
              className="slot-panel-flip-face slot-panel-flip-front"
              style={styles.flipFace}
              tabIndex={card.face === "front" ? 0 : -1}
              aria-hidden={card.face !== "front"}
            >
              <p style={styles.cardFaceText}>{card.front}</p>
            </div>
            <div
              className="slot-panel-flip-face slot-panel-flip-back"
              style={{ ...styles.flipFace, ...styles.flipFaceBack }}
              tabIndex={card.face === "back" ? 0 : -1}
              aria-hidden={card.face !== "back"}
            >
              <p style={styles.cardFaceText}>{card.back}</p>
            </div>
          </div>
        </div>

        {card.face === "back" && config.result ? (
          <CardsResultBanner result={config.result} />
        ) : null}
      </div>
    </PanelLayout>
  );
}

interface CardsResultBannerProps {
  result: CardsPanelResult;
}

function CardsResultBanner({ result }: CardsResultBannerProps) {
  return (
    <div
      className={`slot-panel-cards-result slot-panel-cards-result-${result.status}`}
      style={styles.cardsResult}
      role="status"
      aria-live="polite"
    >
      <strong style={styles.cardsResultTitle}>{result.title}</strong>
      {result.message ? (
        <span style={styles.cardsResultMessage}>{result.message}</span>
      ) : null}
    </div>
  );
}

// =============================================================================
// Grid Panel Renderer
// =============================================================================

interface GridPanelProps {
  config: GridPanelConfig;
  onClose: () => void;
}

function GridPanel({ config, onClose }: GridPanelProps) {
  const { emptyMessage, columns, cells, result } = config;
  const hasCells = cells.length > 0;

  return (
    <PanelLayout panel={config} onClose={onClose}>
      <div
        className="slot-panel-body slot-panel-grid-content"
        style={styles.gridContent}
      >
        <div className="slot-panel-grid-viewport" style={styles.gridViewport}>
          {result ? (
            <GridResult result={result} />
          ) : !hasCells ? (
            <div style={styles.emptyState}>
              <p style={styles.emptyText}>{emptyMessage ?? "No cells"}</p>
            </div>
          ) : (
            <div
              style={{
                ...styles.grid,
                gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                width: `min(100cqw, calc(100cqh * ${columns} / ${Math.ceil(cells.length / columns)}), 300px)`,
              }}
            >
              {cells.map((cell, index) => (
                <GridCell key={cell.id} cell={cell} index={index} />
              ))}
            </div>
          )}
        </div>
      </div>
    </PanelLayout>
  );
}

interface GridResultProps {
  result: GridPanelResult;
}

function GridResult({ result }: GridResultProps) {
  const symbol =
    result.status === "success" ? "✓" : result.status === "error" ? "×" : "–";

  return (
    <div
      className="slot-panel-grid-result"
      style={styles.gridResult}
      role="status"
      aria-live="polite"
    >
      <span
        className={`slot-panel-grid-result-symbol slot-panel-grid-result-symbol-${result.status}`}
        style={styles.gridResultSymbol}
        aria-hidden="true"
      >
        {symbol}
      </span>
      <h3 style={styles.gridResultTitle}>{result.title}</h3>
      {result.message ? (
        <p style={styles.gridResultMessage}>{result.message}</p>
      ) : null}
    </div>
  );
}

interface GridCellProps {
  cell: GridPanelCell;
  index: number;
}

function GridCell({ cell, index }: GridCellProps) {
  const interaction = usePanelAction();
  const statusStyle = getGridStatusStyle(cell.status);
  const clickable = typeof cell.onClick === "function" && !cell.disabled;

  return (
    <button
      type="button"
      className="slot-panel-grid-cell"
      onClick={clickable ? () => void interaction.run(cell.onClick) : undefined}
      disabled={!clickable || interaction.pending}
      aria-label={
        cell.ariaLabel ??
        (cell.sublabel
          ? `${cell.label} ${cell.sublabel}`
          : cell.label || `Cell ${index + 1}`)
      }
      style={{
        ...styles.gridCell,
        ...statusStyle,
        animationDelay: `${index * 30}ms`,
        cursor: clickable ? "pointer" : "default",
      }}
    >
      {interaction.error ? <span role="alert">{interaction.error}</span> : null}
      <span style={styles.gridCellLabel}>{cell.label || "\u00A0"}</span>
      {cell.sublabel && (
        <span style={styles.gridCellSublabel}>{cell.sublabel}</span>
      )}
    </button>
  );
}

// =============================================================================
// List Panel Renderer
// =============================================================================

interface ListPanelProps {
  config: ListPanelConfig;
  onClose: () => void;
}

function ListPanel({ config, onClose }: ListPanelProps) {
  const { emptyMessage, items, sections } = config;

  const hasItems =
    (items && items.length > 0) ||
    (sections && sections.some((s) => s.items.length > 0));

  return (
    <PanelLayout panel={config} onClose={onClose}>
      {/* Content */}
      <div className="slot-panel-body" style={styles.content}>
        {!hasItems ? (
          <div style={styles.emptyState}>
            <p style={styles.emptyText}>{emptyMessage ?? "No items"}</p>
          </div>
        ) : sections ? (
          // Render sections
          sections.map((section) => (
            <PanelSection key={section.id} section={section} />
          ))
        ) : items ? (
          // Render flat list
          <ul style={styles.itemList}>
            {items.map((item, index) => (
              <PanelItem key={item.id} item={item} index={index} />
            ))}
          </ul>
        ) : null}
      </div>
    </PanelLayout>
  );
}

// =============================================================================
// Panel Section Component
// =============================================================================

interface PanelSectionProps {
  section: ListPanelSection;
}

function PanelSection({ section }: PanelSectionProps) {
  const [isCollapsed, setIsCollapsed] = useState(
    section.defaultCollapsed ?? false,
  );

  return (
    <section style={styles.section}>
      <div style={styles.sectionHeader}>
        <h3 style={styles.sectionTitle}>
          {section.collapsible ? (
            <button
              type="button"
              aria-expanded={!isCollapsed}
              onClick={() => setIsCollapsed((current) => !current)}
              style={{
                border: 0,
                padding: 0,
                background: "transparent",
                color: "inherit",
                font: "inherit",
                textTransform: "inherit",
                letterSpacing: "inherit",
                cursor: "pointer",
              }}
            >
              <span aria-hidden="true" style={{ marginRight: "8px" }}>
                {isCollapsed ? "▸" : "▾"}
              </span>
              {section.title} ({section.items.length})
            </button>
          ) : (
            <>
              {section.title} ({section.items.length})
            </>
          )}
        </h3>
        {section.actions && (
          <div style={styles.sectionActions}>
            {section.actions.map((action) => (
              <ActionButton
                key={action.id}
                action={action}
                appearance="section"
              />
            ))}
          </div>
        )}
      </div>

      {!isCollapsed && (
        <ul style={styles.itemList}>
          {section.items.map((item, index) => (
            <PanelItem key={item.id} item={item} index={index} />
          ))}
        </ul>
      )}
    </section>
  );
}

// =============================================================================
// Panel Item Component
// =============================================================================

interface PanelItemProps {
  item: ListPanelItem;
  index: number;
}

function PanelItem({ item, index }: PanelItemProps) {
  const interaction = usePanelAction();
  const Content = item.onClick ? "button" : "div";
  const statusStyle = getStatusStyle(item.status);

  return (
    <li
      className="slot-panel-item"
      style={{
        ...styles.item,
        ...statusStyle,
        animationDelay: `${index * 50}ms`,
      }}
    >
      {item.checkable && (
        <button
          onClick={() => void interaction.run(item.onToggle)}
          disabled={!item.onToggle || interaction.pending}
          style={{
            ...styles.checkbox,
            ...(item.checked && styles.checkboxChecked),
          }}
          className="slot-panel-checkbox"
          aria-label={item.checked ? "Mark as incomplete" : "Mark as complete"}
        >
          {item.checked && <CheckIcon />}
        </button>
      )}

      {item.mediaUrl && (
        <img
          src={item.mediaUrl}
          alt={item.mediaAlt ?? ""}
          style={styles.itemMedia}
        />
      )}

      <Content
        {...(item.onClick
          ? { type: "button" as const, disabled: interaction.pending }
          : {})}
        style={{
          ...styles.itemContent,
          border: 0,
          background: "transparent",
          color: "inherit",
          font: "inherit",
          textAlign: "left",
        }}
        className={item.onClick ? "slot-panel-item-clickable" : undefined}
        onClick={
          item.onClick ? () => void interaction.run(item.onClick) : undefined
        }
      >
        <span
          style={{
            ...styles.itemLabel,
            ...(item.checked && styles.itemLabelChecked),
          }}
        >
          {item.label}
        </span>
        {item.sublabel && (
          <span style={styles.itemSublabel}>{item.sublabel}</span>
        )}
        {interaction.error ? (
          <span role="alert">{interaction.error}</span>
        ) : null}
      </Content>
    </li>
  );
}

// =============================================================================
// Action Button Component
// =============================================================================

interface ActionButtonProps {
  action: PanelAction;
  forceDisabled?: boolean;
  appearance?: "panel" | "section";
}

function ActionButton({
  action,
  forceDisabled = false,
  appearance = "panel",
}: ActionButtonProps) {
  const interaction = usePanelAction();
  const variantStyle = getActionVariantStyle(action.variant);
  const disabled =
    action.disabled === true || forceDisabled || interaction.pending;

  return (
    <>
      <button
        onClick={() => {
          if (!disabled) void interaction.run(action.onClick);
        }}
        disabled={disabled}
        style={
          appearance === "section"
            ? styles.sectionActionButton
            : { ...styles.actionButton, ...variantStyle }
        }
        className={
          appearance === "section"
            ? "slot-panel-section-action"
            : "slot-panel-action"
        }
      >
        {action.label}
      </button>
      {interaction.error ? <p role="alert">{interaction.error}</p> : null}
    </>
  );
}

// =============================================================================
// Icons
// =============================================================================

function CloseIcon() {
  return (
    <XIcon size={20} weight="regular" aria-hidden="true" focusable={false} />
  );
}

function CheckIcon() {
  return (
    <CheckGlyph size={14} weight="bold" aria-hidden="true" focusable={false} />
  );
}

// =============================================================================
// Style Helpers
// =============================================================================

function getStatusStyle(status?: ItemStatus): CSSProperties {
  switch (status) {
    case "active":
      return {
        borderColor: "var(--accent, #5a9bc4)",
        boxShadow:
          "0 0 0 1px var(--accent-glow, rgba(90, 155, 196, 0.3)), 0 0 12px var(--accent-glow, rgba(90, 155, 196, 0.3))",
      };
    case "success":
      return {
        borderColor: "var(--success, #4ade80)",
        backgroundColor: "var(--success-dim, rgba(74, 222, 128, 0.2))",
      };
    case "warning":
      return {
        borderColor: "var(--warning, #fbbf24)",
        backgroundColor: "rgba(251, 191, 36, 0.1)",
      };
    case "error":
      return {
        borderColor: "var(--error, #f87171)",
        backgroundColor: "var(--error-dim, rgba(248, 113, 113, 0.2))",
      };
    default:
      return {};
  }
}

/** Grid cells always set resettable fields so a prior "active" glow cannot stick. */
function getGridStatusStyle(status?: ItemStatus): CSSProperties {
  const highlight = getStatusStyle(status);
  if (status && status !== "default") {
    return {
      backgroundColor: "var(--bg-glass, rgba(30, 41, 59, 0.8))",
      ...highlight,
    };
  }
  return {
    borderColor: "var(--border, rgba(148, 163, 184, 0.2))",
    boxShadow: "none",
    backgroundColor: "var(--bg-glass, rgba(30, 41, 59, 0.8))",
  };
}

function getActionVariantStyle(
  variant?: PanelAction["variant"],
): CSSProperties {
  switch (variant) {
    case "primary":
      return {
        backgroundColor: "var(--accent, #5a9bc4)",
        color: "var(--bg-primary, #0f172a)",
      };
    case "danger":
      return {
        backgroundColor: "var(--error-dim, rgba(248, 113, 113, 0.2))",
        color: "var(--error, #f87171)",
        borderColor: "var(--error, #f87171)",
      };
    default:
      return {};
  }
}

// =============================================================================
// CSS Styles (as string for animations)
// =============================================================================

const panelStyles = `
  @keyframes slotPanelSlideUp {
    from {
      transform: translateY(100%);
    }
    to {
      transform: translateY(0);
    }
  }

  @keyframes slotPanelSlideDown {
    from {
      transform: translateY(0);
    }
    to {
      transform: translateY(100%);
    }
  }

  @keyframes slotPanelBackdropFadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes slotPanelBackdropFadeOut {
    from {
      opacity: 1;
    }
    to {
      opacity: 0;
    }
  }

  @keyframes slotPanelItemFadeIn {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes slotPanelResultEnter {
    from {
      opacity: 0;
      transform: translateY(8px) scale(0.96);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .inline-slot-panel {
  --slot-panel-title-size: 16px;
  --slot-panel-content-padding: 12px 14px;
  --slot-panel-action-padding: 8px 12px;
  --slot-panel-action-font-size: 13px;
  --slot-panel-action-flex: 0 1 auto;
  --slot-panel-result-padding: 12px;
  --slot-panel-result-symbol-size: 48px;
  --slot-panel-result-icon-size: 28px;
  --slot-panel-result-title-size: 20px;
  --slot-panel-result-gap: 10px;
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }


  .slot-panel-heading { min-width: 0; flex: 1; }
  .slot-panel-heading h2 { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .slot-panel-header { gap: 12px; }
  .slot-panel-close { flex-shrink: 0; }
  .slot-panel-status { display: block; font-size: 12px; color: var(--text-muted, #94a3b8); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .slot-panel-status-success { color: var(--success, #4ade80); }
  .slot-panel-status-warning { color: var(--warning, #fbbf24); }
  .slot-panel-status-error { color: var(--error, #f87171); }
  .slot-panel-progress { display: flex; align-items: center; gap: 8px; font-size: 11px; color: var(--text-muted, #94a3b8); }
  .slot-panel-progress-track { height: 3px; width: 64px; background: var(--bg-tertiary, #334155); border-radius: 4px; overflow: hidden; }
  .slot-panel-progress-track > span { display: block; height: 100%; background: var(--accent, #5a9bc4); }
  .slot-panel-body { min-width: 0; overscroll-behavior: contain; }
  .slot-panel-document-content { min-height: 0; }
  .slot-panel-document-body { min-width: 0; }
  .slot-panel-grid-viewport { container-type: size; }
  .slot-panel-grid-cell { min-width: 0; min-height: 0; }
  .slot-panel-footer { display: flex; align-items: center; gap: 8px; flex-shrink: 0; padding: 8px 12px; border-top: 1px solid var(--border, #334155); overflow-x: auto; }
  .slot-panel-footer > .slot-panel-action { flex: 0 0 auto; white-space: nowrap; }
  .slot-panel-footer .slot-panel-action { padding: 7px 10px; min-height: 32px; font-size: 13px; }
  .slot-panel-footer [role="alert"] { font-size: 12px; min-width: 140px; }
  .slot-panel-cards-content { overflow: hidden; }
  .slot-panel-cards-result { flex-shrink: 0; max-height: 45%; overflow: auto; }

  .slot-panel-sheet::backdrop {
    background-color: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    animation: slotPanelBackdropFadeIn ${ANIMATION_DURATION}ms ease-out forwards;
  }

  .slot-panel-sheet.exiting::backdrop {
    animation: slotPanelBackdropFadeOut ${ANIMATION_DURATION}ms ease-out forwards;
  }

  .slot-panel-sheet {
    position: fixed;
    top: auto;
    margin: 0;
    padding: 0;
    width: 100%;
    max-width: none;
    box-sizing: border-box;
    color: inherit;
    bottom: 0;
    left: 0;
    right: 0;
    max-height: 70vh;
    background-color: var(--bg-secondary, #1e293b);
    border-top-left-radius: var(--radius-xl, 24px);
    border-top-right-radius: var(--radius-xl, 24px);
    border: 1px solid var(--border, rgba(148, 163, 184, 0.2));
    border-bottom: none;
    z-index: 101;
    display: flex;
    flex-direction: column;
    box-shadow: 0 -4px 30px rgba(0, 0, 0, 0.3);
    animation: slotPanelSlideUp ${ANIMATION_DURATION}ms cubic-bezier(0.32, 0.72, 0, 1) forwards;
  }

  .slot-panel-sheet.exiting {
    animation: slotPanelSlideDown ${ANIMATION_DURATION}ms cubic-bezier(0.32, 0.72, 0, 1) forwards;
  }

  .slot-panel-sheet-grid {
    height: min(70vh, 500px);
  }

  .slot-panel-sheet-cards {
    height: min(70vh, 560px);
  }

  .slot-panel-flip-scene {
    perspective: 1200px;
  }

  .slot-panel-flip-card {
    position: relative;
    width: 100%;
    height: 100%;
    transform-style: preserve-3d;
    transition: transform 400ms cubic-bezier(0.32, 0.72, 0, 1);
  }

  .slot-panel-flip-scene.flipped .slot-panel-flip-card {
    transform: rotateY(180deg);
  }

  .slot-panel-flip-face {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: safe center;
    justify-content: safe center;
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
    border-radius: var(--radius-lg, 16px);
    border: 1px solid var(--border, rgba(148, 163, 184, 0.2));
    background: var(--bg-glass, rgba(30, 41, 59, 0.9));
    padding: 12px;
    overflow: auto;
  }

  .slot-panel-flip-back {
    transform: rotateY(180deg);
  }

  .slot-panel-answer-input:focus {
    outline: none;
    border-color: var(--accent, #5a9bc4);
  }

  .slot-panel-cards-result-success {
    border-color: var(--success, #4ade80);
    background: var(--success-dim, rgba(74, 222, 128, 0.12));
  }

  .slot-panel-cards-result-error {
    border-color: var(--error, #f87171);
    background: var(--error-dim, rgba(248, 113, 113, 0.12));
  }

  .slot-panel-cards-result-default {
    border-color: var(--border, rgba(148, 163, 184, 0.35));
    background: var(--bg-glass, rgba(30, 41, 59, 0.8));
  }

  .slot-panel-item {
    animation: slotPanelItemFadeIn 200ms ease-out backwards;
  }

  .slot-panel-close:hover {
    color: var(--text-primary, #f1f5f9);
    background: var(--bg-glass, rgba(30, 41, 59, 0.8));
  }

  .slot-panel-section-action:hover {
    color: var(--text-primary, #f1f5f9);
    background: var(--bg-glass, rgba(30, 41, 59, 0.8));
  }

  .slot-panel-checkbox:hover {
    border-color: var(--accent, #5a9bc4);
  }

  .slot-panel-item-clickable:hover {
    background: var(--bg-glass-light, rgba(51, 65, 85, 0.6));
    border-radius: var(--radius-sm, 6px);
  }

  .slot-panel-action:hover:not(:disabled) {
    opacity: 0.9;
    transform: translateY(-1px);
  }

  .slot-panel-action:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .slot-panel-grid-cell {
    animation: slotPanelItemFadeIn 200ms ease-out backwards;
  }

  .slot-panel-grid-cell:hover:not(:disabled) {
    border-color: var(--accent, #5a9bc4);
    background: var(--bg-glass-light, rgba(51, 65, 85, 0.6));
  }

  .slot-panel-grid-cell:focus {
    outline: none;
  }

  .slot-panel-grid-cell:focus-visible:not(:disabled) {
    outline: 2px solid var(--accent, #5a9bc4);
    outline-offset: 2px;
  }

  .slot-panel-grid-cell:disabled {
    cursor: default;
  }

  .slot-panel-grid-result {
    animation: slotPanelResultEnter 250ms ease-out both;
  }

  .slot-panel-grid-result-symbol-success {
    color: var(--success, #4ade80);
    border-color: var(--success, #4ade80);
    background: var(--success-dim, rgba(74, 222, 128, 0.12));
  }

  .slot-panel-grid-result-symbol-error {
    color: var(--error, #f87171);
    border-color: var(--error, #f87171);
    background: var(--error-dim, rgba(248, 113, 113, 0.12));
  }

  .slot-panel-grid-result-symbol-default {
    color: var(--text-muted, #94a3b8);
    border-color: var(--border, rgba(148, 163, 184, 0.35));
    background: var(--bg-glass, rgba(30, 41, 59, 0.8));
  }

  @media (prefers-reduced-motion: reduce) {
    .slot-panel-grid-result {
      animation: none;
    }

    .slot-panel-flip-card {
      transition: none;
    }
  }
`;

// =============================================================================
// Inline Styles
// =============================================================================

const styles: Record<string, CSSProperties> = {
  handleWrapper: {
    display: "flex",
    justifyContent: "center",
    padding: "12px 0 4px",
  },
  handle: {
    width: "36px",
    height: "4px",
    backgroundColor: "var(--bg-tertiary, #334155)",
    borderRadius: "2px",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "var(--slot-panel-header-padding, 8px 20px 16px)",
    borderBottom: "1px solid var(--border, rgba(148, 163, 184, 0.2))",
    flexShrink: 0,
  },
  title: {
    fontSize: "var(--slot-panel-title-size, 18px)",
    fontWeight: "600",
    color: "var(--text-primary, #f1f5f9)",
    margin: 0,
  },
  closeButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "36px",
    height: "36px",
    borderRadius: "var(--radius-md, 10px)",
    color: "var(--text-muted, #94a3b8)",
    cursor: "pointer",
    transition: "color 150ms ease, background 150ms ease",
    border: "none",
    background: "transparent",
    padding: 0,
  },
  content: {
    minHeight: 0,
    flex: 1,
    overflow: "auto",
    padding: "var(--slot-panel-content-padding, 16px 20px 24px)",
  },
  documentBody: {
    margin: 0,
    fontSize: "14px",
    lineHeight: 1.55,
    color: "var(--text-primary, #f1f5f9)",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  gridContent: {
    flex: 1,
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    padding: "var(--slot-panel-content-padding, 16px 20px 20px)",
  },
  gridViewport: {
    flex: 1,
    minHeight: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  gridResult: {
    width: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    padding: "var(--slot-panel-result-padding, 24px 20px)",
  },
  gridResultSymbol: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "var(--slot-panel-result-symbol-size, 72px)",
    height: "var(--slot-panel-result-symbol-size, 72px)",
    border: "2px solid",
    borderRadius: "50%",
    fontSize: "var(--slot-panel-result-icon-size, 42px)",
    fontWeight: "500",
    lineHeight: 1,
    marginBottom: "var(--slot-panel-result-gap, 18px)",
  },
  gridResultTitle: {
    margin: 0,
    color: "var(--text-primary, #f1f5f9)",
    fontSize: "var(--slot-panel-result-title-size, 26px)",
    fontWeight: "650",
    lineHeight: 1.2,
  },
  gridResultMessage: {
    maxWidth: "280px",
    margin: "8px 0 0",
    color: "var(--text-muted, #94a3b8)",
    fontSize: "14px",
    lineHeight: 1.5,
  },
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "16px",
    textAlign: "center",
  },
  emptyText: {
    fontSize: "16px",
    fontWeight: "500",
    color: "var(--text-muted, #94a3b8)",
    margin: 0,
  },
  section: {
    marginBottom: "12px",
  },
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "12px",
  },
  sectionTitle: {
    fontSize: "13px",
    fontWeight: "600",
    color: "var(--text-dim, #64748b)",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    margin: 0,
    display: "flex",
    alignItems: "center",
  },
  sectionActions: {
    display: "flex",
    gap: "8px",
  },
  sectionActionButton: {
    fontSize: "12px",
    color: "var(--text-muted, #94a3b8)",
    cursor: "pointer",
    padding: "4px 8px",
    borderRadius: "var(--radius-sm, 6px)",
    transition: "color 150ms ease, background 150ms ease",
    border: "none",
    background: "transparent",
  },
  itemList: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  grid: {
    display: "grid",
    gap: "8px",
    margin: "0 auto",
  },
  gridCell: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    aspectRatio: "1 / 1",
    padding: "4px",
    backgroundColor: "var(--bg-glass, rgba(30, 41, 59, 0.8))",
    borderRadius: "var(--radius-md, 10px)",
    border: "1px solid var(--border, rgba(148, 163, 184, 0.2))",
    color: "var(--text-primary, #f1f5f9)",
    transition:
      "border-color 150ms ease, box-shadow 150ms ease, background 150ms ease",
  },
  gridCellLabel: {
    fontSize: "22px",
    fontWeight: "600",
    lineHeight: 1.2,
  },
  gridCellSublabel: {
    fontSize: "11px",
    color: "var(--text-muted, #94a3b8)",
    marginTop: "4px",
  },
  item: {
    display: "flex",
    alignItems: "flex-start",
    gap: "12px",
    padding: "12px",
    backgroundColor: "var(--bg-glass, rgba(30, 41, 59, 0.8))",
    borderRadius: "var(--radius-md, 10px)",
    border: "1px solid var(--border, rgba(148, 163, 184, 0.2))",
    transition:
      "border-color 150ms ease, box-shadow 150ms ease, background 150ms ease",
  },
  itemMedia: {
    width: "48px",
    height: "48px",
    borderRadius: "var(--radius-sm, 6px)",
    objectFit: "cover",
    flexShrink: 0,
  },
  checkbox: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "22px",
    height: "22px",
    borderRadius: "6px",
    border: "2px solid var(--border, rgba(148, 163, 184, 0.2))",
    backgroundColor: "transparent",
    cursor: "pointer",
    flexShrink: 0,
    marginTop: "2px",
    transition:
      "border-color 150ms ease, background 150ms ease, transform 150ms ease",
    padding: 0,
  },
  checkboxChecked: {
    borderColor: "var(--success, #4ade80)",
    backgroundColor: "var(--success, #4ade80)",
    color: "var(--bg-primary, #0f172a)",
  },
  itemContent: {
    flex: 1,
    minWidth: 0,
    cursor: "pointer",
    padding: "2px 4px",
    margin: "-2px -4px",
    transition: "background 150ms ease",
    borderRadius: "var(--radius-sm, 6px)",
  },
  itemLabel: {
    display: "block",
    fontSize: "14px",
    fontWeight: "500",
    color: "var(--text-primary, #f1f5f9)",
    lineHeight: "1.4",
    wordBreak: "break-word",
  },
  itemLabelChecked: {
    textDecoration: "line-through",
    color: "var(--text-dim, #64748b)",
  },
  itemSublabel: {
    display: "block",
    fontSize: "12px",
    color: "var(--text-muted, #94a3b8)",
    marginTop: "4px",
  },

  cardsContent: {
    flex: 1,
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    overflow: "auto",
    padding: "var(--slot-panel-content-padding, 16px 20px 24px)",
  },

  flipScene: {
    flex: 1,
    width: "100%",
    minHeight: 0,
  },
  flipCard: {
    height: "100%",
    width: "100%",
    minHeight: 0,
  },
  flipFace: {
    minHeight: 0,
  },
  flipFaceBack: {},
  cardFaceText: {
    margin: 0,
    fontSize: "18px",
    fontWeight: "600",
    lineHeight: 1.35,
    textAlign: "center",
    color: "var(--text-primary, #f1f5f9)",
    wordBreak: "break-word",
  },
  answerForm: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    gap: "8px",
    alignItems: "center",
  },
  answerInput: {
    flex: 1,
    minWidth: 0,
    padding: "8px 10px",
    borderRadius: "var(--radius-md, 10px)",
    border: "1px solid var(--border, rgba(148, 163, 184, 0.2))",
    backgroundColor: "var(--bg-glass, rgba(30, 41, 59, 0.8))",
    color: "var(--text-primary, #f1f5f9)",
    fontSize: "14px",
  },
  cardsResult: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    padding: "8px 10px",
    borderRadius: "var(--radius-md, 10px)",
    borderWidth: "1px",
    borderStyle: "solid",
  },
  cardsResultTitle: {
    fontSize: "14px",
    color: "var(--text-primary, #f1f5f9)",
  },
  cardsResultMessage: {
    fontSize: "12px",
    color: "var(--text-muted, #94a3b8)",
  },

  actionButton: {
    flex: "var(--slot-panel-action-flex, 1)",
    padding: "var(--slot-panel-action-padding, 12px 16px)",
    fontSize: "var(--slot-panel-action-font-size, 14px)",
    fontWeight: "500",
    borderRadius: "var(--radius-md, 10px)",
    border: "1px solid var(--border, rgba(148, 163, 184, 0.2))",
    backgroundColor: "var(--bg-glass, rgba(30, 41, 59, 0.8))",
    color: "var(--text-primary, #f1f5f9)",
    cursor: "pointer",
    transition: "opacity 150ms ease, transform 150ms ease",
  },
};
