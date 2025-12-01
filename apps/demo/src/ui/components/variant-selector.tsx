import { useState } from "react";
import { getAllVariants, getVariant } from "@vokality/ragdoll";

interface VariantSelectorProps {
  currentVariantId: string;
  onVariantChange: (variantId: string) => void;
}

export function VariantSelector({
  currentVariantId,
  onVariantChange,
}: VariantSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const variants = getAllVariants();
  const currentVariant = getVariant(currentVariantId);

  return (
    <div style={styles.container}>
      <button onClick={() => setIsOpen(!isOpen)} style={styles.trigger}>
        <span style={styles.triggerLabel}>VARIANT:</span>
        <span style={styles.triggerValue}>
          {currentVariant.name.toUpperCase()}
        </span>
        <span style={styles.triggerArrow}>{isOpen ? "▲" : "▼"}</span>
      </button>

      {isOpen && (
        <>
          <div style={styles.backdrop} onClick={() => setIsOpen(false)} />
          <div style={styles.dropdown}>
            <div style={styles.dropdownHeader}>
              ╔══════════════════════════╗
            </div>
            <div style={styles.dropdownTitle}>║ SELECT_VARIANT.exe ║</div>
            <div style={styles.dropdownDivider}>
              ╠══════════════════════════╣
            </div>
            <div style={styles.dropdownContent}>
              {variants.map((variant, index) => (
                <button
                  key={variant.id}
                  onClick={() => {
                    onVariantChange(variant.id);
                    setIsOpen(false);
                  }}
                  style={{
                    ...styles.option,
                    ...(variant.id === currentVariantId
                      ? styles.optionActive
                      : {}),
                  }}
                >
                  <span style={styles.optionIndex}>
                    {(index + 1).toString().padStart(2, "0")}.
                  </span>
                  <span style={styles.optionName}>
                    {variant.id === currentVariantId ? ">" : " "}{" "}
                    {variant.name.toUpperCase()}
                  </span>
                  {variant.id === currentVariantId && (
                    <span style={styles.optionCheck}>[*]</span>
                  )}
                </button>
              ))}
            </div>
            <div style={styles.dropdownFooter}>
              ╚══════════════════════════╝
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const styles = {
  container: {
    position: "relative" as const,
    display: "inline-block",
    fontFamily: "var(--retro-font, 'VT323', monospace)",
  },
  trigger: {
    padding: "10px 14px",
    backgroundColor: "var(--retro-bg, #0a0a0a)",
    border: "2px solid var(--retro-green, #33ff33)",
    borderRadius: "0",
    cursor: "pointer",
    fontSize: "16px",
    fontFamily: "var(--retro-font, 'VT323', monospace)",
    color: "var(--retro-green, #33ff33)",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    textShadow: "0 0 8px rgba(51, 255, 51, 0.6)",
    boxShadow: "0 0 10px rgba(51, 255, 51, 0.2)",
  },
  triggerLabel: {
    color: "var(--retro-green-dim, #1a8c1a)",
  },
  triggerValue: {
    fontWeight: "normal",
  },
  triggerArrow: {
    fontSize: "12px",
    marginLeft: "4px",
  },
  backdrop: {
    position: "fixed" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
  },
  dropdown: {
    position: "absolute" as const,
    top: "100%",
    left: 0,
    marginTop: "8px",
    backgroundColor: "var(--retro-bg, #0a0a0a)",
    border: "2px solid var(--retro-green, #33ff33)",
    zIndex: 1000,
    minWidth: "280px",
    boxShadow:
      "0 0 20px rgba(51, 255, 51, 0.2), inset 0 0 40px rgba(51, 255, 51, 0.03)",
    fontFamily: "var(--retro-font, 'VT323', monospace)",
    color: "var(--retro-green, #33ff33)",
    animation: "fade-in 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
  },
  dropdownHeader: {
    fontSize: "15px",
    color: "var(--retro-green-dim, #1a8c1a)",
    textAlign: "center" as const,
    letterSpacing: "-1px",
    paddingTop: "4px",
  },
  dropdownTitle: {
    fontSize: "16px",
    textAlign: "center" as const,
    textShadow: "0 0 8px rgba(51, 255, 51, 0.6)",
    letterSpacing: "-1px",
  },
  dropdownDivider: {
    fontSize: "15px",
    color: "var(--retro-green-dim, #1a8c1a)",
    textAlign: "center" as const,
    letterSpacing: "-1px",
  },
  dropdownContent: {
    maxHeight: "300px",
    overflowY: "auto" as const,
    padding: "4px 8px",
  },
  dropdownFooter: {
    fontSize: "15px",
    color: "var(--retro-green-dim, #1a8c1a)",
    textAlign: "center" as const,
    letterSpacing: "-1px",
    paddingBottom: "4px",
  },
  option: {
    width: "100%",
    padding: "10px 12px",
    textAlign: "left" as const,
    backgroundColor: "transparent",
    border: "2px solid transparent",
    borderRadius: "0",
    cursor: "pointer",
    fontSize: "16px",
    fontFamily: "var(--retro-font, 'VT323', monospace)",
    color: "var(--retro-green, #33ff33)",
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  optionActive: {
    backgroundColor: "rgba(51, 255, 51, 0.15)",
    borderColor: "var(--retro-green, #33ff33)",
    textShadow: "0 0 8px rgba(51, 255, 51, 0.6)",
  },
  optionIndex: {
    color: "var(--retro-green-dim, #1a8c1a)",
    fontSize: "14px",
    minWidth: "28px",
  },
  optionName: {
    flex: 1,
    letterSpacing: "0.5px",
  },
  optionCheck: {
    color: "var(--retro-amber, #ffb000)",
    textShadow: "0 0 8px rgba(255, 176, 0, 0.6)",
  },
};

