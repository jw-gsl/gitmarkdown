import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";

const { fontFamily } = loadFont("normal", { weights: ["400", "600", "700"], subsets: ["latin"] });
const { fontFamily: monoFont } = loadMono("normal", { weights: ["400"], subsets: ["latin"] });

const TYPED_TEXT = `# Getting Started

Welcome to **GitMarkdown** — the collaborative
markdown editor that syncs with GitHub.

## Features
- Real-time editing with rich formatting
- GitHub sync on every save`;

export const SceneEditor: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Window scale in
  const windowScale = spring({ frame, fps, config: { damping: 15, stiffness: 120 } });

  // Typing effect — 2 chars per frame
  const charsVisible = Math.min(Math.floor(frame * 2.2), TYPED_TEXT.length);
  const visibleText = TYPED_TEXT.slice(0, charsVisible);

  // Cursor blink
  const cursorVisible = Math.floor(frame / 8) % 2 === 0 || frame < 80;

  // Zoom effect
  const zoom = interpolate(frame, [60, 90], [1, 1.15], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Label fade in
  const labelOpacity = interpolate(frame, [5, 20], [0, 1], {
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
      }}
    >
      {/* Section label */}
      <div
        style={{
          opacity: labelOpacity,
          fontSize: 22,
          fontWeight: 600,
          color: "#22D3EE",
          letterSpacing: 3,
          textTransform: "uppercase",
          marginBottom: 24,
        }}
      >
        Rich Markdown Editor
      </div>

      {/* Editor window */}
      <div
        style={{
          transform: `scale(${windowScale * zoom})`,
          width: 1100,
          borderRadius: 16,
          overflow: "hidden",
          boxShadow: "0 25px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08)",
        }}
      >
        {/* Title bar */}
        <div
          style={{
            background: "#1e1e2e",
            padding: "12px 20px",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#ff5f57" }} />
          <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#febc2e" }} />
          <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#28c840" }} />
          <div
            style={{
              marginLeft: 16,
              fontSize: 13,
              color: "rgba(255,255,255,0.5)",
              fontFamily: monoFont,
            }}
          >
            README.md
          </div>
        </div>

        {/* Toolbar */}
        <div
          style={{
            background: "#1a1a2e",
            padding: "8px 20px",
            display: "flex",
            gap: 6,
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          {["B", "I", "U", "H1", "</>", "Link", "List"].map((btn) => (
            <div
              key={btn}
              style={{
                padding: "4px 10px",
                borderRadius: 6,
                background: "rgba(255,255,255,0.05)",
                color: "rgba(255,255,255,0.6)",
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {btn}
            </div>
          ))}
        </div>

        {/* Editor content */}
        <div
          style={{
            background: "#13131f",
            padding: "28px 36px",
            minHeight: 320,
            position: "relative",
          }}
        >
          <pre
            style={{
              fontFamily: monoFont,
              fontSize: 18,
              lineHeight: 1.7,
              color: "#e2e8f0",
              margin: 0,
              whiteSpace: "pre-wrap",
            }}
          >
            {renderMarkdown(visibleText)}
            {cursorVisible && (
              <span
                style={{
                  display: "inline-block",
                  width: 2,
                  height: 22,
                  background: "#22D3EE",
                  marginLeft: 1,
                  verticalAlign: "text-bottom",
                }}
              />
            )}
          </pre>
        </div>
      </div>
    </div>
  );
};

function renderMarkdown(text: string): React.ReactNode[] {
  return text.split("\n").map((line, i) => {
    if (line.startsWith("# ")) {
      return (
        <div key={i} style={{ fontSize: 32, fontWeight: 700, color: "#fff", marginBottom: 8 }}>
          {line.slice(2)}
        </div>
      );
    }
    if (line.startsWith("## ")) {
      return (
        <div key={i} style={{ fontSize: 24, fontWeight: 700, color: "#22D3EE", marginTop: 12, marginBottom: 4 }}>
          {line.slice(3)}
        </div>
      );
    }
    if (line.startsWith("- ")) {
      return (
        <div key={i} style={{ paddingLeft: 16 }}>
          <span style={{ color: "#22D3EE" }}>{">"}</span> {renderInline(line.slice(2))}
        </div>
      );
    }
    return <div key={i}>{renderInline(line)}</div>;
  });
}

function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const boldRegex = /\*\*(.+?)\*\*/g;
  let lastIdx = 0;
  let match;
  while ((match = boldRegex.exec(text)) !== null) {
    if (match.index > lastIdx) parts.push(text.slice(lastIdx, match.index));
    parts.push(
      <span key={match.index} style={{ fontWeight: 700, color: "#22D3EE" }}>
        {match[1]}
      </span>
    );
    lastIdx = match.index + match[0].length;
  }
  if (lastIdx < text.length) parts.push(text.slice(lastIdx));
  return parts;
}
