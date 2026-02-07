import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", { weights: ["400", "600", "700", "900"], subsets: ["latin"] });

const AI_TEXT = "Refactored the introduction to be more concise and added a code example for the API integration section.";

export const SceneAI: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const labelOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Chat bubble scale in
  const promptPop = spring({ frame, fps, delay: 10, config: { damping: 15 } });

  // AI response typing
  const responseDelay = 35;
  const responseFrame = Math.max(0, frame - responseDelay);
  const aiChars = Math.min(Math.floor(responseFrame * 2.5), AI_TEXT.length);
  const aiVisible = AI_TEXT.slice(0, aiChars);
  const aiOpacity = interpolate(frame, [responseDelay, responseDelay + 5], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Sparkle animation
  const sparkle1 = spring({ frame, fps, delay: 25, config: { damping: 8, stiffness: 200 } });
  const sparkle2 = spring({ frame, fps, delay: 30, config: { damping: 8, stiffness: 200 } });

  // Feature pills
  const features = [
    { label: "AI Edit", delay: 55 },
    { label: "AI Chat", delay: 60 },
    { label: "Smart Commits", delay: 65 },
    { label: "PR Summaries", delay: 70 },
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
          top: 180,
          left: 320,
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
          top: 280,
          right: 380,
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
          marginBottom: 30,
        }}
      >
        AI-Powered Editing
      </div>

      {/* Chat interface */}
      <div style={{ width: 800, display: "flex", flexDirection: "column", gap: 16 }}>
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
            padding: "14px 20px",
            maxWidth: 500,
          }}
        >
          <div style={{ fontSize: 16, color: "#e2e8f0" }}>
            Make this section more concise and add a code example
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
            padding: "14px 20px",
            maxWidth: 600,
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
          <div style={{ fontSize: 15, color: "#e2e8f0", lineHeight: 1.6 }}>
            {aiVisible}
            {aiChars < AI_TEXT.length && (
              <span
                style={{
                  display: "inline-block",
                  width: 2,
                  height: 18,
                  background: "#22D3EE",
                  marginLeft: 2,
                  verticalAlign: "text-bottom",
                }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Feature pills */}
      <div style={{ display: "flex", gap: 12, marginTop: 40 }}>
        {features.map((f) => {
          const s = spring({ frame, fps, delay: f.delay, config: { damping: 15 } });
          return (
            <div
              key={f.label}
              style={{
                opacity: s,
                transform: `translateY(${interpolate(s, [0, 1], [15, 0])}px)`,
                padding: "8px 20px",
                borderRadius: 30,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.8)",
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              {f.label}
            </div>
          );
        })}
      </div>
    </div>
  );
};
