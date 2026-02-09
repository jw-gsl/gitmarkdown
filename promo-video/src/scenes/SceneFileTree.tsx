import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";

const { fontFamily } = loadFont("normal", { weights: ["400", "600", "700"], subsets: ["latin"] });
const { fontFamily: monoFont } = loadMono("normal", { weights: ["400"], subsets: ["latin"] });

const FILES = [
  { name: "src", isFolder: true, indent: 0, delay: 8 },
  { name: "components", isFolder: true, indent: 1, delay: 12 },
  { name: "Editor.tsx", isFolder: false, indent: 2, delay: 16 },
  { name: "Toolbar.tsx", isFolder: false, indent: 2, delay: 20 },
  { name: "FileTree.tsx", isFolder: false, indent: 2, delay: 24, active: true },
  { name: "lib", isFolder: true, indent: 1, delay: 28 },
  { name: "github.ts", isFolder: false, indent: 2, delay: 32 },
  { name: "README.md", isFolder: false, indent: 0, delay: 36 },
  { name: "package.json", isFolder: false, indent: 0, delay: 40 },
];

const CODE_LINES = [
  { text: "export function FileTree({", color: "#c586c0" },
  { text: "  files,", color: "#9cdcfe" },
  { text: "  onSelect,", color: "#9cdcfe" },
  { text: "  sortBy = 'name',", color: "#9cdcfe" },
  { text: "}: FileTreeProps) {", color: "#c586c0" },
  { text: "  const sorted = useMemo(", color: "#dcdcaa" },
  { text: "    () => sortFiles(files, sortBy),", color: "#ce9178" },
  { text: "    [files, sortBy]", color: "#9cdcfe" },
  { text: "  );", color: "#c586c0" },
  { text: "", color: "" },
  { text: "  return (", color: "#c586c0" },
  { text: "    <TreeView items={sorted} />", color: "#4ec9b0" },
];

export const SceneFileTree: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const labelOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const panelScale = spring({ frame, fps, config: { damping: 15, stiffness: 120 } });

  // Code viewer slides in
  const codeSlide = spring({ frame, fps, delay: 30, config: { damping: 18 } });
  const codeX = interpolate(codeSlide, [0, 1], [80, 0]);

  // Export buttons
  const exportPop = spring({ frame, fps, delay: 60, config: { damping: 12 } });

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
          color: "#22D3EE",
          letterSpacing: 3,
          textTransform: "uppercase",
          marginBottom: 24,
        }}
      >
        File Tree & Code Viewer
      </div>

      <div style={{ display: "flex", gap: 2, transform: `scale(${panelScale})` }}>
        {/* File tree sidebar */}
        <div
          style={{
            width: 280,
            borderRadius: "16px 0 0 16px",
            background: "#13131f",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRight: "none",
            padding: "16px 0",
            boxShadow: "0 25px 80px rgba(0,0,0,0.4)",
          }}
        >
          {/* Search bar */}
          <div
            style={{
              margin: "0 12px 12px",
              padding: "8px 12px",
              borderRadius: 8,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.06)",
              fontSize: 12,
              color: "rgba(255,255,255,0.3)",
              fontFamily: monoFont,
            }}
          >
            Search files...
          </div>

          {/* File entries */}
          {FILES.map((f, i) => {
            const s = spring({ frame, fps, delay: f.delay, config: { damping: 15 } });
            return (
              <div
                key={i}
                style={{
                  opacity: s,
                  transform: `translateX(${interpolate(s, [0, 1], [-20, 0])}px)`,
                  padding: "6px 12px 6px " + (12 + f.indent * 16) + "px",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 13,
                  color: (f as { active?: boolean }).active ? "#22D3EE" : "#e2e8f0",
                  background: (f as { active?: boolean }).active
                    ? "rgba(34,211,238,0.08)"
                    : "transparent",
                  fontFamily: monoFont,
                }}
              >
                <span style={{ fontSize: 12, opacity: 0.6 }}>
                  {f.isFolder ? "\u{1F4C1}" : "\u{1F4C4}"}
                </span>
                {f.name}
              </div>
            );
          })}
        </div>

        {/* Code viewer */}
        <div
          style={{
            width: 650,
            borderRadius: "0 16px 16px 0",
            overflow: "hidden",
            boxShadow: "0 25px 80px rgba(0,0,0,0.4)",
            opacity: codeSlide,
            transform: `translateX(${codeX}px)`,
          }}
        >
          {/* Title bar */}
          <div
            style={{
              background: "#1e1e2e",
              padding: "10px 16px",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#ff5f57" }} />
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#febc2e" }} />
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#28c840" }} />
            <span
              style={{ marginLeft: 12, fontSize: 12, color: "rgba(255,255,255,0.5)", fontFamily: monoFont }}
            >
              FileTree.tsx
            </span>
          </div>

          {/* Code content */}
          <div style={{ background: "#13131f", padding: "20px 24px", minHeight: 340 }}>
            {CODE_LINES.map((line, i) => {
              const lineDelay = 35 + i * 3;
              const lineOpacity = interpolate(frame, [lineDelay, lineDelay + 8], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    gap: 16,
                    opacity: lineOpacity,
                    fontFamily: monoFont,
                    fontSize: 15,
                    lineHeight: 1.8,
                  }}
                >
                  <span style={{ color: "rgba(255,255,255,0.15)", width: 24, textAlign: "right" }}>
                    {i + 1}
                  </span>
                  <span style={{ color: line.color }}>{line.text}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Export options */}
      <div
        style={{
          display: "flex",
          gap: 12,
          marginTop: 20,
          opacity: exportPop,
          transform: `scale(${exportPop})`,
        }}
      >
        {["Markdown", "PDF", "HTML"].map((fmt, i) => {
          const s = spring({ frame, fps, delay: 62 + i * 5, config: { damping: 12 } });
          return (
            <div
              key={fmt}
              style={{
                opacity: s,
                padding: "6px 16px",
                borderRadius: 8,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.7)",
                fontSize: 13,
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span style={{ fontSize: 11 }}>{"\u2B07"}</span>
              {fmt}
            </div>
          );
        })}
      </div>
    </div>
  );
};
