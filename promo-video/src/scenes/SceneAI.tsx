import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", { weights: ["400", "600", "700", "900"], subsets: ["latin"] });

const AI_TEXT = "Refactored the introduction for clarity and added a TypeScript code example.";

export const SceneAI: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const labelOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Persona selector
  const personaPop = spring({ frame, fps, delay: 8, config: { damping: 14 } });

  // Chat bubble scale in
  const promptPop = spring({ frame, fps, delay: 18, config: { damping: 15 } });

  // AI response typing
  const responseDelay = 32;
  const responseFrame = Math.max(0, frame - responseDelay);
  const aiChars = Math.min(Math.floor(responseFrame * 3), AI_TEXT.length);
  const aiVisible = AI_TEXT.slice(0, aiChars);
  const aiOpacity = interpolate(frame, [responseDelay, responseDelay + 5], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Sparkle animation
  const sparkle1 = spring({ frame, fps, delay: 25, config: { damping: 8, stiffness: 200 } });
  const sparkle2 = spring({ frame, fps, delay: 30, config: { damping: 8, stiffness: 200 } });

  // Feature pills - expanded
  const features = [
    { label: "AI Edit", delay: 58, icon: "\u270F\uFE0F" },
    { label: "AI Chat", delay: 62, icon: "\uD83D\uDCAC" },
    { label: "Personas", delay: 66, icon: "\uD83C\uDFAD" },
    { label: "Smart Commits", delay: 70, icon: "\uD83D\uDCE6" },
    { label: "PR Summaries", delay: 74, icon: "\uD83D\uDD17" },
    { label: "Web Search", delay: 78, icon: "\uD83C\uDF10" },
  ];

  // Personas
  const personas = [
    { name: "Editor", active: false },
    { name: "Technical Writer", active: true },
    { name: "Code Reviewer", active: false },
  ];

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
      {/* Sparkles */}
      <div
        style={{
          position: "absolute",
          top: 160,
          left: 300,
          fontSize: 30,
          transform: `scale(${sparkle1}) rotate(${sparkle1 * 30}deg)`,
          opacity: sparkle1 * 0.6,
        }}
      >
        {"\u2728"}
      </div>
      <div
        style={{
          position: "absolute",
          top: 300,
          right: 350,
          fontSize: 24,
          transform: `scale(${sparkle2}) rotate(${sparkle2 * -20}deg)`,
          opacity: sparkle2 * 0.5,
        }}
      >
        {"\u2728"}
      </div>

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
        AI-Powered Editing
      </div>

      <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
        {/* Chat interface */}
        <div style={{ width: 680, display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Persona selector bar */}
          <div
            style={{
              display: "flex",
              gap: 8,
              opacity: personaPop,
              transform: `translateY(${interpolate(personaPop, [0, 1], [10, 0])}px)`,
              marginBottom: 4,
            }}
          >
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", padding: "6px 0" }}>
              Persona:
            </span>
            {personas.map((p) => (
              <div
                key={p.name}
                style={{
                  padding: "5px 14px",
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 600,
                  background: p.active ? "rgba(34,211,238,0.15)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${p.active ? "rgba(34,211,238,0.3)" : "rgba(255,255,255,0.06)"}`,
                  color: p.active ? "#22D3EE" : "rgba(255,255,255,0.5)",
                }}
              >
                {p.name}
              </div>
            ))}
          </div>

          {/* User prompt */}
          <div
            style={{
              alignSelf: "flex-end",
              transform: `scale(${promptPop})`,
              opacity: promptPop,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 16,
              borderBottomRightRadius: 4,
              padding: "12px 18px",
              maxWidth: 480,
            }}
          >
            <div style={{ fontSize: 15, color: "#e2e8f0" }}>
              Make this section more concise and add a code example
            </div>
            <div
              style={{
                fontSize: 11,
                color: "rgba(255,255,255,0.3)",
                marginTop: 6,
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <span>@</span>README.md
            </div>
          </div>

          {/* AI response */}
          <div
            style={{
              alignSelf: "flex-start",
              opacity: aiOpacity,
              background: "rgba(34,211,238,0.08)",
              border: "1px solid rgba(34,211,238,0.2)",
              borderRadius: 16,
              borderBottomLeftRadius: 4,
              padding: "12px 18px",
              maxWidth: 560,
              display: "flex",
              gap: 12,
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: "#22D3EE",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                fontSize: 14,
              }}
            >
              {"\u2728"}
            </div>
            <div style={{ fontSize: 14, color: "#e2e8f0", lineHeight: 1.6 }}>
              {aiVisible}
              {aiChars < AI_TEXT.length && (
                <span
                  style={{
                    display: "inline-block",
                    width: 2,
                    height: 17,
                    background: "#22D3EE",
                    marginLeft: 2,
                    verticalAlign: "text-bottom",
                  }}
                />
              )}
            </div>
          </div>
        </div>

        {/* AI tools sidebar */}
        <div
          style={{
            width: 180,
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.3)", marginBottom: 4 }}>
            AI Tools
          </div>
          {[
            { icon: "\u{1F4C4}", name: "Read File" },
            { icon: "\u{1F50D}", name: "Search Code" },
            { icon: "\u270F\uFE0F", name: "Edit File" },
            { icon: "\u{1F4DD}", name: "Write File" },
            { icon: "\u{1F310}", name: "Web Search" },
            { icon: "\u{1F517}", name: "Fetch URL" },
          ].map((tool, i) => {
            const s = spring({ frame, fps, delay: 20 + i * 4, config: { damping: 15 } });
            return (
              <div
                key={tool.name}
                style={{
                  opacity: s,
                  transform: `translateX(${interpolate(s, [0, 1], [15, 0])}px)`,
                  padding: "7px 12px",
                  borderRadius: 8,
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.05)",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 12,
                  color: "rgba(255,255,255,0.6)",
                }}
              >
                <span style={{ fontSize: 13 }}>{tool.icon}</span>
                {tool.name}
              </div>
            );
          })}
        </div>
      </div>

      {/* Feature pills */}
      <div style={{ display: "flex", gap: 10, marginTop: 28, flexWrap: "wrap", justifyContent: "center" }}>
        {features.map((f) => {
          const s = spring({ frame, fps, delay: f.delay, config: { damping: 15 } });
          return (
            <div
              key={f.label}
              style={{
                opacity: s,
                transform: `translateY(${interpolate(s, [0, 1], [12, 0])}px)`,
                padding: "6px 16px",
                borderRadius: 30,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.8)",
                fontSize: 13,
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span style={{ fontSize: 12 }}>{f.icon}</span>
              {f.label}
            </div>
          );
        })}
      </div>
    </div>
  );
};
