import type { Detection } from "../api/client";

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 16px",
  fontWeight: 500,
  fontFamily: "var(--font-body)",
  color: "var(--color-ink-tertiary)",
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  borderBottom: "1px solid var(--border-color)",
  background: "var(--color-surface-hover)",
};

const tdStyle: React.CSSProperties = {
  padding: "12px 16px",
  borderBottom: "1px solid var(--border-color)",
  color: "var(--color-ink-secondary)",
  fontSize: 13,
  fontFamily: "var(--font-body)",
};

function confBadge(confidence: number): React.CSSProperties {
  const pct = confidence * 100;
  const color = pct >= 80 ? "var(--color-high)" : pct >= 50 ? "var(--color-moderate)" : "var(--color-ink-tertiary)";
  const bg = pct >= 80 ? "var(--color-high-bg)" : pct >= 50 ? "var(--color-moderate-bg)" : "var(--color-surface-inset)";
  return {
    display: "inline-flex",
    padding: "3px 8px",
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 600,
    fontVariantNumeric: "tabular-nums",
    color,
    background: bg,
    fontFamily: "var(--font-body)",
  };
}

export default function FindingsTable({ detections }: { detections: Detection[] }) {
  if (detections.length === 0) {
    return (
      <div
        className="cavio-card"
        style={{
          width: "100%",
          padding: "28px 20px",
          textAlign: "center",
          color: "var(--color-ink-tertiary)",
        }}
        role="status"
        aria-live="polite"
      >
        <div style={{ fontSize: 14, fontWeight: 500, color: "var(--color-ink-secondary)", marginBottom: 4 }}>
          No detections
        </div>
        <div style={{ fontSize: 13, fontFamily: "var(--font-body)" }}>
          Zero findings on this scan. Review the image clinically as needed.
        </div>
      </div>
    );
  }

  return (
    <div
      className="cavio-card"
      style={{
        width: "100%",
        overflow: "hidden",
      }}
    >
      <div className="mobile-table-scroll">
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={thStyle}>Class</th>
              <th style={thStyle}>Confidence</th>
              <th style={thStyle}>Location</th>
            </tr>
          </thead>
          <tbody>
            {detections.map((d, i) => (
              <tr
                key={i}
                style={{ transition: "background 0.1s" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-surface-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <td style={{ ...tdStyle, fontWeight: 500, color: "var(--color-ink)" }}>{d.class_name}</td>
                <td style={tdStyle}>
                  <span style={confBadge(d.confidence)}>
                    {(d.confidence * 100).toFixed(1)}%
                  </span>
                </td>
                <td style={{ ...tdStyle, fontFamily: "'SF Mono', 'Fira Code', monospace", fontSize: 11, color: "var(--color-ink-tertiary)", letterSpacing: "0.02em" }}>
                  [{d.bbox.map((v) => v.toFixed(0)).join(", ")}]
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}