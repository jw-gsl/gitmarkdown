import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", { weights: ["400", "600", "700", "900"], subsets: ["latin"] });

export const SceneGitSync: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const labelOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Commit nodes animate in sequence
  const commits = [
    { msg: "Update README.md", time: "just now", delay: 10 },
    { msg: "Add API documentation", time: "2m ago", delay: 22 },
    { msg: "Fix formatting in guide.md", time: "5m ago", delay: 34 },
    { msg: "Initial commit", time: "1h ago", delay: 46 },
  ];

  // Sync arrow pulse
  const syncPulse = interpolate(frame, [60, 75, 90], [1, 1.2, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const checkOpacity = interpolate(frame, [70, 80], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

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
        position: "relative",
      }}
    >
      {/* Label */}
      <div
        style={{
          opacity: labelOpacity,
          fontSize: 22,
          fontWeight: 600,
          color: "#22D3EE",
          letterSpacing: 3,
          textTransform: "uppercase",
          marginBottom: 40,
        }}
      >
        GitHub Sync
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 80 }}>
        {/* GitMarkdown side */}
        <div
          style={{
            width: 380,
            borderRadius: 16,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid #27272a",
            padding: "24px",
            boxShadow: "0 0 40px rgba(0,0,0,0.3)",
          }}
        >
          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: "#e4e4e7",
              marginBottom: 20,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <rect width="24" height="24" rx="5" fill="#22D3EE" />
              <path d="M7 8h10M7 12h6M7 16h8" stroke="white" strokeWidth="2" strokeLinecap="round" />
            </svg>
            GitMarkdown
          </div>
          {commits.map((c, i) => {
            const s = spring({ frame, fps, delay: c.delay, config: { damping: 15 } });
            return (
              <div
                key={i}
                style={{
                  opacity: s,
                  transform: `translateX(${interpolate(s, [0, 1], [-30, 0])}px)`,
                  padding: "10px 14px",
                  borderRadius: 8,
                  background: i === 0 ? "rgba(34,211,238,0.1)" : "rgba(255,255,255,0.03)",
                  marginBottom: 8,
                  border: i === 0 ? "1px solid rgba(34,211,238,0.2)" : "1px solid transparent",
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 600, color: "#e2e8f0" }}>{c.msg}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>{c.time}</div>
              </div>
            );
          })}
        </div>

        {/* Sync arrows */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
            transform: `scale(${syncPulse})`,
          }}
        >
          <svg width="60" height="30" viewBox="0 0 60 30">
            <path d="M5 15h40M45 15l-10-8M45 15l-10 8" stroke="#22D3EE" strokeWidth="3" strokeLinecap="round" />
          </svg>
          <div
            style={{
              opacity: checkOpacity,
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "#22C55E",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M5 13l4 4L19 7" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <svg width="60" height="30" viewBox="0 0 60 30">
            <path d="M55 15H15M15 15l10-8M15 15l10 8" stroke="#6b7280" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </div>

        {/* GitHub side */}
        <div
          style={{
            width: 380,
            borderRadius: 16,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(34,211,238,0.3)",
            padding: "24px",
            boxShadow: "0 0 40px rgba(0,0,0,0.3)",
          }}
        >
          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: "#22D3EE",
              marginBottom: 20,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.009-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836a9.59 9.59 0 012.504.337c1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
            </svg>
            GitHub
          </div>
          {commits.map((c, i) => {
            const s = spring({ frame, fps, delay: c.delay + 10, config: { damping: 15 } });
            return (
              <div
                key={i}
                style={{
                  opacity: s,
                  transform: `translateX(${interpolate(s, [0, 1], [30, 0])}px)`,
                  padding: "10px 14px",
                  borderRadius: 8,
                  background: "rgba(255,255,255,0.03)",
                  marginBottom: 8,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: i === 0 ? "#22C55E" : "#6b7280",
                    flexShrink: 0,
                  }}
                />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#e2e8f0" }}>{c.msg}</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>{c.time}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
