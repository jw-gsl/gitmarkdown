import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", { weights: ["400", "600", "700"], subsets: ["latin"] });

const AVATARS = [
  { name: "Alice", color: "#22D3EE", initial: "A" },
  { name: "Bob", color: "#22D3EE", initial: "B" },
  { name: "Carol", color: "#F59E0B", initial: "C" },
];

export const SceneCollaborate: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const labelOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Cursors appear one by one
  const cursor1 = spring({ frame, fps, delay: 15, config: { damping: 15 } });
  const cursor2 = spring({ frame, fps, delay: 30, config: { damping: 15 } });
  const cursor3 = spring({ frame, fps, delay: 45, config: { damping: 15 } });

  // Comment bubble pop in
  const commentPop = spring({ frame, fps, delay: 55, config: { damping: 12 } });

  // Reaction emoji bounce
  const reactionPop = spring({ frame, fps, delay: 70, config: { damping: 10, stiffness: 200 } });

  // Cursor positions animate
  const c1x = interpolate(frame, [15, 60], [200, 450], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const c2x = interpolate(frame, [30, 70], [600, 380], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const c3y = interpolate(frame, [45, 80], [100, 260], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

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
      <div
        style={{
          opacity: labelOpacity,
          fontSize: 22,
          fontWeight: 600,
          color: "#F59E0B",
          letterSpacing: 3,
          textTransform: "uppercase",
          marginBottom: 30,
        }}
      >
        Real-Time Collaboration
      </div>

      {/* Document area */}
      <div
        style={{
          width: 900,
          height: 440,
          borderRadius: 16,
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.08)",
          position: "relative",
          overflow: "hidden",
          padding: 32,
        }}
      >
        {/* Fake document lines */}
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div
            key={i}
            style={{
              height: 14,
              borderRadius: 4,
              background: `rgba(255,255,255,${i < 2 ? 0.12 : 0.05})`,
              marginBottom: 16,
              width: `${70 + ((i * 23) % 30)}%`,
            }}
          />
        ))}

        {/* Cursor 1 - Alice */}
        <div
          style={{
            position: "absolute",
            left: c1x,
            top: 80,
            opacity: cursor1,
            transform: `scale(${cursor1})`,
          }}
        >
          <div style={{ width: 2, height: 24, background: "#22D3EE", borderRadius: 1 }} />
          <div
            style={{
              background: "#22D3EE",
              color: "#0a0a0f",
              fontSize: 11,
              fontWeight: 600,
              padding: "2px 8px",
              borderRadius: 4,
              marginTop: 2,
              whiteSpace: "nowrap",
            }}
          >
            Alice
          </div>
        </div>

        {/* Cursor 2 - Bob */}
        <div
          style={{
            position: "absolute",
            left: c2x,
            top: 160,
            opacity: cursor2,
            transform: `scale(${cursor2})`,
          }}
        >
          <div style={{ width: 2, height: 24, background: "#22D3EE", borderRadius: 1 }} />
          <div
            style={{
              background: "#22D3EE",
              color: "#0f172a",
              fontSize: 11,
              fontWeight: 600,
              padding: "2px 8px",
              borderRadius: 4,
              marginTop: 2,
              whiteSpace: "nowrap",
            }}
          >
            Bob
          </div>
        </div>

        {/* Cursor 3 - Carol */}
        <div
          style={{
            position: "absolute",
            left: 550,
            top: c3y,
            opacity: cursor3,
            transform: `scale(${cursor3})`,
          }}
        >
          <div style={{ width: 2, height: 24, background: "#F59E0B", borderRadius: 1 }} />
          <div
            style={{
              background: "#F59E0B",
              color: "#0f172a",
              fontSize: 11,
              fontWeight: 600,
              padding: "2px 8px",
              borderRadius: 4,
              marginTop: 2,
              whiteSpace: "nowrap",
            }}
          >
            Carol
          </div>
        </div>

        {/* Comment bubble */}
        <div
          style={{
            position: "absolute",
            right: 40,
            top: 60,
            transform: `scale(${commentPop})`,
            opacity: commentPop,
            background: "rgba(34,211,238,0.1)",
            border: "1px solid rgba(34,211,238,0.2)",
            borderRadius: 12,
            padding: "12px 16px",
            maxWidth: 220,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, color: "#22D3EE", marginBottom: 4 }}>Bob</div>
          <div style={{ fontSize: 13, color: "#e2e8f0" }}>Looks great! Ship it.</div>
          <div
            style={{
              marginTop: 8,
              transform: `scale(${reactionPop})`,
              opacity: reactionPop,
              display: "inline-flex",
              gap: 4,
              background: "rgba(255,255,255,0.06)",
              borderRadius: 20,
              padding: "3px 8px",
              fontSize: 14,
            }}
          >
            <span>{"\uD83D\uDE80"}</span>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>2</span>
          </div>
        </div>

        {/* Online avatars */}
        <div
          style={{
            position: "absolute",
            bottom: 20,
            right: 20,
            display: "flex",
            gap: -8,
          }}
        >
          {AVATARS.map((a, i) => {
            const s = spring({ frame, fps, delay: 10 + i * 12, config: { damping: 12 } });
            return (
              <div
                key={i}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: a.color,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white",
                  fontSize: 14,
                  fontWeight: 700,
                  border: "2px solid #0a0a0f",
                  marginLeft: i > 0 ? -8 : 0,
                  transform: `scale(${s})`,
                  opacity: s,
                }}
              >
                {a.initial}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
