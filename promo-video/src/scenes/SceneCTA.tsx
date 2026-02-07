import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", { weights: ["400", "600", "700", "900"], subsets: ["latin"] });

export const SceneCTA: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Logo bounce
  const logoScale = spring({ frame, fps, config: { damping: 10, stiffness: 150 } });

  // CTA text
  const ctaProgress = spring({ frame, fps, delay: 12, config: { damping: 15 } });
  const ctaY = interpolate(ctaProgress, [0, 1], [40, 0]);

  // URL fade in
  const urlOpacity = interpolate(frame, [25, 40], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Subtle pulse on CTA
  const pulse = interpolate(frame, [40, 55, 70], [1, 1.03, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Background gradient shift
  const bgAngle = interpolate(frame, [0, 75], [130, 160]);

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
      {/* Subtle cyan glow orb */}
      <div
        style={{
          position: "absolute",
          width: 400,
          height: 400,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(34,211,238,0.1) 0%, transparent 70%)",
          filter: "blur(50px)",
          top: "30%",
          left: "35%",
        }}
      />

      {/* Logo */}
      <div style={{ transform: `scale(${logoScale})`, marginBottom: 24 }}>
        <svg width="80" height="80" viewBox="0 0 24 24" fill="none">
          <rect width="24" height="24" rx="6" fill="#18181b" stroke="#27272a" strokeWidth="1" />
          <path d="M7 8h10M7 12h6M7 16h8" stroke="white" strokeWidth="2" strokeLinecap="round" />
          <circle cx="18" cy="16" r="3" fill="#22D3EE" />
        </svg>
      </div>

      {/* Title */}
      <div
        style={{
          transform: `translateY(${ctaY}px) scale(${pulse})`,
          opacity: ctaProgress,
        }}
      >
        <span style={{ fontSize: 72, fontWeight: 900, color: "white", letterSpacing: -2 }}>Git</span>
        <span
          style={{
            fontSize: 72,
            fontWeight: 900,
            color: "#22D3EE",
            letterSpacing: -2,
          }}
        >
          Markdown
        </span>
      </div>

      {/* Tagline */}
      <div
        style={{
          opacity: urlOpacity,
          fontSize: 24,
          color: "rgba(255,255,255,0.7)",
          fontWeight: 400,
          marginTop: 12,
          marginBottom: 32,
        }}
      >
        The collaborative markdown editor for GitHub
      </div>

      {/* CTA button */}
      <div
        style={{
          opacity: urlOpacity,
          transform: `scale(${pulse})`,
          background: "#22D3EE",
          padding: "16px 48px",
          borderRadius: 12,
          fontSize: 20,
          fontWeight: 700,
          color: "#0a0a0f",
          letterSpacing: 0.5,
          boxShadow: "0 8px 32px rgba(34,211,238,0.2)",
        }}
      >
        Start Writing Today
      </div>
    </div>
  );
};
