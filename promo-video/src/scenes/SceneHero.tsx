import { useCurrentFrame, useVideoConfig, interpolate, spring, Sequence } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "700", "900"],
  subsets: ["latin"],
});

export const SceneHero: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoScale = spring({ frame, fps, config: { damping: 12, stiffness: 150 } });
  const logoRotate = interpolate(logoScale, [0, 1], [-15, 0]);

  const titleProgress = spring({ frame, fps, delay: 15, config: { damping: 20 } });
  const titleY = interpolate(titleProgress, [0, 1], [60, 0]);
  const titleOpacity = interpolate(titleProgress, [0, 1], [0, 1]);

  const taglineOpacity = interpolate(frame, [40, 60], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const taglineY = interpolate(frame, [40, 60], [20, 0], {
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
      {/* Subtle grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Soft glow */}
      <div
        style={{
          position: "absolute",
          width: 600,
          height: 600,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(34,211,238,0.1) 0%, transparent 70%)",
          filter: "blur(60px)",
          transform: `scale(${0.8 + logoScale * 0.3})`,
        }}
      />

      {/* Logo icon */}
      <div
        style={{
          transform: `scale(${logoScale}) rotate(${logoRotate}deg)`,
          marginBottom: 30,
        }}
      >
        <svg width="120" height="120" viewBox="0 0 24 24" fill="none">
          <rect width="24" height="24" rx="6" fill="#18181b" stroke="#27272a" strokeWidth="0.5" />
          <path d="M7 8h10M7 12h6M7 16h8" stroke="#e4e4e7" strokeWidth="2" strokeLinecap="round" />
          <circle cx="18" cy="16" r="3" fill="#22D3EE" />
        </svg>
      </div>

      {/* Title */}
      <div
        style={{
          transform: `translateY(${titleY}px)`,
          opacity: titleOpacity,
        }}
      >
        <span
          style={{
            fontSize: 90,
            fontWeight: 900,
            color: "white",
            letterSpacing: -2,
          }}
        >
          Git
        </span>
        <span
          style={{
            fontSize: 90,
            fontWeight: 900,
            color: "#22D3EE",
            letterSpacing: -2,
          }}
        >
          Markdown
        </span>
      </div>

      {/* Tagline */}
      <Sequence from={0}>
        <div
          style={{
            opacity: taglineOpacity,
            transform: `translateY(${taglineY}px)`,
            fontSize: 28,
            color: "rgba(255,255,255,0.5)",
            fontWeight: 400,
            marginTop: 16,
            letterSpacing: 1,
          }}
        >
          Write. Collaborate. Ship.
        </div>
      </Sequence>
    </div>
  );
};
