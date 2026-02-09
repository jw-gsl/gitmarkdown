import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", { weights: ["400", "600", "700"], subsets: ["latin"] });

const CHECKS = [
  {
    type: "grammar",
    icon: "\u{1F4DD}",
    title: "Grammar",
    issue: '"Their is a problem" \u2192 "There is a problem"',
    color: "#22D3EE",
    delay: 15,
  },
  {
    type: "brevity",
    icon: "\u2702\uFE0F",
    title: "Brevity",
    issue: '"In order to" \u2192 "To"',
    color: "#F59E0B",
    delay: 25,
  },
  {
    type: "passive",
    icon: "\u{1F4AA}",
    title: "Passive Voice",
    issue: '"was updated by the team" \u2192 "the team updated"',
    color: "#a78bfa",
    delay: 35,
  },
  {
    type: "cliche",
    icon: "\u{1F6AB}",
    title: "Clich\u00E9s",
    issue: '"at the end of the day" \u2192 "ultimately"',
    color: "#f472b6",
    delay: 45,
  },
];

const CODE_CHECKS = [
  { icon: "\u{1F41B}", label: "Bug Detection", color: "#ef4444" },
  { icon: "\u{1F512}", label: "Security Scan", color: "#F59E0B" },
  { icon: "\u26A1", label: "Performance", color: "#22D3EE" },
];

export const SceneWritingChecks: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const labelOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const panelScale = spring({ frame, fps, delay: 5, config: { damping: 14 } });

  // Score counter animation
  const scoreProgress = interpolate(frame, [50, 70], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const score = Math.round(scoreProgress * 94);

  // Fix all button
  const fixPop = spring({ frame, fps, delay: 60, config: { damping: 12 } });

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
          color: "#a78bfa",
          letterSpacing: 3,
          textTransform: "uppercase",
          marginBottom: 24,
        }}
      >
        Writing Checks
      </div>

      <div style={{ display: "flex", gap: 24, transform: `scale(${panelScale})` }}>
        {/* Writing checks panel */}
        <div
          style={{
            width: 520,
            borderRadius: 16,
            background: "#13131f",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 25px 80px rgba(0,0,0,0.4)",
            overflow: "hidden",
          }}
        >
          {/* Panel header */}
          <div
            style={{
              padding: "14px 20px",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: 15, fontWeight: 700, color: "#e2e8f0" }}>Writing Analysis</span>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span style={{ fontSize: 24, fontWeight: 900, color: score >= 90 ? "#22C55E" : "#F59E0B" }}>
                {score}
              </span>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>/100</span>
            </div>
          </div>

          {/* Check items */}
          <div style={{ padding: "12px 16px" }}>
            {CHECKS.map((check) => {
              const s = spring({ frame, fps, delay: check.delay, config: { damping: 15 } });
              return (
                <div
                  key={check.type}
                  style={{
                    opacity: s,
                    transform: `translateX(${interpolate(s, [0, 1], [-20, 0])}px)`,
                    padding: "10px 14px",
                    borderRadius: 10,
                    marginBottom: 8,
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.05)",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <span style={{ fontSize: 18 }}>{check.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: check.color, marginBottom: 2 }}>
                      {check.title}
                    </div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{check.issue}</div>
                  </div>
                  <div
                    style={{
                      padding: "4px 10px",
                      borderRadius: 6,
                      background: `${check.color}22`,
                      color: check.color,
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    Fix
                  </div>
                </div>
              );
            })}
          </div>

          {/* Fix all button */}
          <div style={{ padding: "8px 16px 16px", display: "flex", justifyContent: "center" }}>
            <div
              style={{
                opacity: fixPop,
                transform: `scale(${fixPop})`,
                padding: "8px 28px",
                borderRadius: 8,
                background: "#a78bfa",
                color: "#0a0a0f",
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              Fix All Issues
            </div>
          </div>
        </div>

        {/* Code checks panel */}
        <div
          style={{
            width: 280,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>
            Code Analysis
          </div>
          {CODE_CHECKS.map((c, i) => {
            const s = spring({ frame, fps, delay: 55 + i * 8, config: { damping: 14 } });
            return (
              <div
                key={c.label}
                style={{
                  opacity: s,
                  transform: `translateY(${interpolate(s, [0, 1], [20, 0])}px)`,
                  padding: "16px 20px",
                  borderRadius: 12,
                  background: "#13131f",
                  border: "1px solid rgba(255,255,255,0.08)",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <span style={{ fontSize: 22 }}>{c.icon}</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: c.color }}>{c.label}</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
                    No issues found
                  </div>
                </div>
                <div
                  style={{
                    marginLeft: "auto",
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    background: "rgba(34,197,94,0.15)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M5 13l4 4L19 7"
                      stroke="#22C55E"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
