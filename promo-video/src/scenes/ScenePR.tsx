import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";

const { fontFamily } = loadFont("normal", { weights: ["400", "600", "700"], subsets: ["latin"] });
const { fontFamily: monoFont } = loadMono("normal", { weights: ["400"], subsets: ["latin"] });

const DIFF_LINES = [
  { type: "context", text: "  ## API Reference", num: "14" },
  { type: "remove", text: "- Old endpoint description", num: "15" },
  { type: "add", text: "+ Updated endpoint with auth headers", num: "15" },
  { type: "add", text: "+ Added rate limiting details", num: "16" },
  { type: "context", text: "  ### Authentication", num: "17" },
  { type: "remove", text: "- Basic auth only", num: "18" },
  { type: "add", text: "+ OAuth 2.0 and API key support", num: "18" },
];

const CHANGED_FILES = [
  { name: "docs/api.md", additions: 12, deletions: 4, status: "modified" },
  { name: "docs/setup.md", additions: 8, deletions: 2, status: "modified" },
  { name: "docs/auth.md", additions: 45, deletions: 0, status: "added" },
];

export const ScenePR: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const labelOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const dialogScale = spring({ frame, fps, delay: 5, config: { damping: 14, stiffness: 120 } });

  // AI generating title
  const aiGlow = interpolate(frame, [20, 30, 40], [0, 1, 0.3], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Diff lines appear
  const diffStart = 25;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#0a0a0f",
        fontFamily,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          opacity: labelOpacity,
          fontSize: 22,
          fontWeight: 600,
          color: "#22C55E",
          letterSpacing: 3,
          textTransform: "uppercase",
          marginBottom: 24,
        }}
      >
        Pull Request Creation
      </div>

      {/* PR Dialog */}
      <div
        style={{
          transform: `scale(${dialogScale})`,
          width: 960,
          borderRadius: 16,
          background: "#13131f",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 25px 80px rgba(0,0,0,0.5)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 24px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <svg width="20" height="20" viewBox="0 0 16 16" fill="#22C55E">
              <path d="M7.177 3.073L9.573.677A.25.25 0 0110 .854v4.792a.25.25 0 01-.427.177L7.177 3.427a.25.25 0 010-.354zM3.75 2.5a.75.75 0 100 1.5.75.75 0 000-1.5zm-2.25.75a2.25 2.25 0 113 2.122v5.256a2.251 2.251 0 11-1.5 0V5.372A2.25 2.25 0 011.5 3.25zM11 2.5h-1V4h1a1 1 0 011 1v5.628a2.251 2.251 0 101.5 0V5A2.5 2.5 0 0011 2.5zm1 10.25a.75.75 0 111.5 0 .75.75 0 01-1.5 0zM3.75 12a.75.75 0 100 1.5.75.75 0 000-1.5z" />
            </svg>
            <span style={{ fontSize: 16, fontWeight: 700, color: "#e2e8f0" }}>New Pull Request</span>
          </div>
          <div style={{ display: "flex", gap: 8, fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
            <span
              style={{
                padding: "4px 10px",
                borderRadius: 6,
                background: "rgba(34,197,94,0.1)",
                border: "1px solid rgba(34,197,94,0.2)",
                color: "#22C55E",
              }}
            >
              feature/api-docs
            </span>
            <span style={{ padding: "4px 0" }}>{"\u2192"}</span>
            <span
              style={{
                padding: "4px 10px",
                borderRadius: 6,
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              main
            </span>
          </div>
        </div>

        <div style={{ display: "flex" }}>
          {/* Left: title + description */}
          <div style={{ flex: 1, padding: 24, borderRight: "1px solid rgba(255,255,255,0.06)" }}>
            {/* AI-generated title */}
            <div style={{ position: "relative", marginBottom: 16 }}>
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: 8,
                  background: "rgba(255,255,255,0.04)",
                  border: `1px solid rgba(34,211,238,${0.1 + aiGlow * 0.3})`,
                  fontSize: 15,
                  fontWeight: 600,
                  color: "#e2e8f0",
                  boxShadow: `0 0 ${aiGlow * 20}px rgba(34,211,238,${aiGlow * 0.1})`,
                }}
              >
                Add comprehensive API documentation
              </div>
              <div
                style={{
                  position: "absolute",
                  top: -8,
                  right: 12,
                  padding: "2px 8px",
                  borderRadius: 4,
                  background: "#22D3EE",
                  color: "#0a0a0f",
                  fontSize: 10,
                  fontWeight: 700,
                  opacity: aiGlow,
                }}
              >
                AI Generated
              </div>
            </div>

            {/* Changed files list */}
            <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.4)", marginBottom: 8 }}>
              Changed Files
            </div>
            {CHANGED_FILES.map((f, i) => {
              const s = spring({ frame, fps, delay: 15 + i * 6, config: { damping: 15 } });
              return (
                <div
                  key={i}
                  style={{
                    opacity: s,
                    padding: "8px 10px",
                    borderRadius: 6,
                    marginBottom: 4,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    background: "rgba(255,255,255,0.02)",
                    fontFamily: monoFont,
                    fontSize: 12,
                  }}
                >
                  <span style={{ color: "#e2e8f0" }}>{f.name}</span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <span style={{ color: "#22C55E" }}>+{f.additions}</span>
                    {f.deletions > 0 && <span style={{ color: "#ef4444" }}>-{f.deletions}</span>}
                    <span
                      style={{
                        padding: "1px 6px",
                        borderRadius: 4,
                        fontSize: 10,
                        fontWeight: 600,
                        background:
                          f.status === "added" ? "rgba(34,197,94,0.15)" : "rgba(245,158,11,0.15)",
                        color: f.status === "added" ? "#22C55E" : "#F59E0B",
                      }}
                    >
                      {f.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right: diff preview */}
          <div style={{ width: 480, padding: "16px 20px" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.4)", marginBottom: 8 }}>
              Diff Preview
            </div>
            <div
              style={{
                borderRadius: 8,
                overflow: "hidden",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              {DIFF_LINES.map((line, i) => {
                const lineOpacity = interpolate(frame, [diffStart + i * 3, diffStart + i * 3 + 6], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                });
                return (
                  <div
                    key={i}
                    style={{
                      opacity: lineOpacity,
                      padding: "4px 12px",
                      fontFamily: monoFont,
                      fontSize: 11,
                      lineHeight: 1.8,
                      background:
                        line.type === "add"
                          ? "rgba(34,197,94,0.08)"
                          : line.type === "remove"
                            ? "rgba(239,68,68,0.08)"
                            : "transparent",
                      color:
                        line.type === "add"
                          ? "#4ade80"
                          : line.type === "remove"
                            ? "#f87171"
                            : "rgba(255,255,255,0.5)",
                      borderLeft: `3px solid ${
                        line.type === "add"
                          ? "#22C55E"
                          : line.type === "remove"
                            ? "#ef4444"
                            : "transparent"
                      }`,
                    }}
                  >
                    <span style={{ opacity: 0.3, marginRight: 12 }}>{line.num}</span>
                    {line.text}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer with create button */}
        <div
          style={{
            padding: "12px 24px",
            borderTop: "1px solid rgba(255,255,255,0.06)",
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
          }}
        >
          {(() => {
            const btnPop = spring({ frame, fps, delay: 55, config: { damping: 12 } });
            return (
              <div
                style={{
                  opacity: btnPop,
                  transform: `scale(${btnPop})`,
                  padding: "8px 24px",
                  borderRadius: 8,
                  background: "#22C55E",
                  color: "#0a0a0f",
                  fontSize: 14,
                  fontWeight: 700,
                }}
              >
                Create Pull Request
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
};
