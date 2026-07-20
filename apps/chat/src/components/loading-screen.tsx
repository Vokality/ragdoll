import { useEffect, useState, type CSSProperties } from "react";

export function LoadingScreen() {
  // Avoid a flash of spinner on fast startups: render nothing briefly,
  // then ease the orb in.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 150);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) {
    return <div style={styles.container} />;
  }

  return (
    <div style={styles.container} role="status" aria-label="Loading Lumen">
      <div className="app-atmosphere" />
      <div className="loading-orb enter-1" />
      <p className="enter-2" style={styles.wordmark}>
        Lumen
      </p>
      <p className="enter-3" style={styles.text}>
        Waking up…
      </p>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    width: "100%",
    background: "var(--bg-primary)",
    gap: "20px",
    position: "relative",
  },
  wordmark: {
    fontSize: "17px",
    fontWeight: 600,
    letterSpacing: "0.32em",
    textTransform: "uppercase",
    color: "var(--text-primary)",
    marginLeft: "0.32em", // visually recenter tracked-out text
    position: "relative",
  },
  text: {
    color: "var(--text-dim)",
    fontSize: "13px",
    position: "relative",
  },
};
