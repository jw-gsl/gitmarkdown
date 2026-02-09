'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSettingsStore } from '@/stores/settings-store';
import {
  getShikiHighlighter,
  getShikiHighlighterSync,
  CODE_THEME_PAIRS,
  type CodeThemeKey,
} from '@/lib/editor/shiki';

// ─── Color Utilities ───

type RGB = [number, number, number];

function hexToRgb(hex: string): RGB {
  let h = hex.replace('#', '');
  // Expand shorthand (#fff → ffffff)
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function rgbToHex([r, g, b]: RGB): string {
  return '#' + [r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('');
}

/** Mix two hex colors. t=0 → a, t=1 → b */
function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return rgbToHex([
    r1 + (r2 - r1) * t,
    g1 + (g2 - g1) * t,
    b1 + (b2 - b1) * t,
  ]);
}

/** Relative luminance (0–1) */
function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// ─── Theme Token Extraction ───

const HLJS_SCOPE_MAP: [string, string[]][] = [
  ['comment', ['comment']],
  ['quote', ['comment', 'markup.quote']],
  ['keyword', ['keyword', 'storage', 'storage.type']],
  ['selector-tag', ['entity.name.tag', 'keyword']],
  ['section', ['entity.name.section', 'keyword']],
  ['name', ['entity.name.tag']],
  ['string', ['string']],
  ['regexp', ['string.regexp', 'string']],
  ['addition', ['markup.inserted', 'string']],
  ['number', ['constant.numeric', 'constant']],
  ['literal', ['constant.language', 'constant']],
  ['built_in', ['support', 'entity.name.type']],
  ['type', ['entity.name.type', 'support.type', 'entity.name']],
  ['attr', ['entity.other.attribute-name']],
  ['attribute', ['entity.other.attribute-name']],
  ['variable', ['variable', 'variable.other']],
  ['template-variable', ['variable.other', 'variable']],
  ['title', ['entity.name.function', 'entity.name', 'entity']],
  ['symbol', ['constant.other.symbol', 'constant']],
  ['bullet', ['constant.other.symbol', 'constant']],
  ['meta', ['meta']],
  ['deletion', ['markup.deleted']],
];

type ThemeSettings = { scope?: string | string[]; settings?: { foreground?: string; fontStyle?: string } };

function extractTokenColors(settings: ThemeSettings[]): Map<string, { fg: string; italic?: boolean }> {
  const scopeMap = new Map<string, { fg: string; italic?: boolean }>();
  for (const rule of settings) {
    const fg = rule.settings?.foreground;
    if (!fg) continue;
    const scopes = Array.isArray(rule.scope)
      ? rule.scope
      : rule.scope
        ? rule.scope.split(',').map((s) => s.trim())
        : [];
    const italic = rule.settings?.fontStyle?.includes('italic');
    for (const scope of scopes) {
      scopeMap.set(scope, { fg, italic });
    }
  }

  const result = new Map<string, { fg: string; italic?: boolean }>();
  for (const [hljsClass, tmScopes] of HLJS_SCOPE_MAP) {
    for (const scope of tmScopes) {
      if (scopeMap.has(scope)) {
        result.set(hljsClass, scopeMap.get(scope)!);
        break;
      }
      for (const [s, color] of scopeMap) {
        if (s.startsWith(scope + '.') || scope.startsWith(s + '.') || s === scope) {
          result.set(hljsClass, color);
          break;
        }
      }
      if (result.has(hljsClass)) break;
    }
  }
  return result;
}

/** Find the first token color matching any of the given TM scopes */
function findScopeColor(settings: ThemeSettings[], targetScopes: string[]): string | undefined {
  for (const target of targetScopes) {
    for (const rule of settings) {
      const fg = rule.settings?.foreground;
      if (!fg) continue;
      const scopes = Array.isArray(rule.scope)
        ? rule.scope
        : rule.scope
          ? rule.scope.split(',').map((s) => s.trim())
          : [];
      for (const s of scopes) {
        if (s === target || s.startsWith(target + '.') || target.startsWith(s + '.')) {
          return fg;
        }
      }
    }
  }
  return undefined;
}

// ─── App Theme CSS Generation ───

interface ThemeColors {
  bg: string;
  fg: string;
  primary: string;
  settings: ThemeSettings[];
}

function generateAppVars(t: ThemeColors): Record<string, string> {
  const { bg, fg, primary } = t;
  const isDark = luminance(bg) < 0.2;

  // Derive UI colors by mixing bg/fg at different ratios
  const card = mix(bg, fg, 0.02);
  const muted = mix(bg, fg, isDark ? 0.08 : 0.04);
  const mutedFg = mix(bg, fg, isDark ? 0.55 : 0.45);
  const accent = mix(bg, fg, isDark ? 0.10 : 0.05);
  const border = mix(bg, fg, isDark ? 0.14 : 0.10);
  const input = mix(bg, fg, isDark ? 0.16 : 0.10);
  const ring = mix(bg, fg, 0.35);
  const sidebar = mix(bg, fg, isDark ? 0.04 : 0.01);
  const sidebarBorder = mix(bg, fg, isDark ? 0.12 : 0.08);

  // Primary foreground: ensure contrast against primary
  const primaryLum = luminance(primary);
  const primaryFg = primaryLum > 0.4 ? '#1a1a1a' : '#fafafa';

  return {
    '--background': bg,
    '--foreground': fg,
    '--card': card,
    '--card-foreground': fg,
    '--popover': card,
    '--popover-foreground': fg,
    '--primary': primary,
    '--primary-foreground': primaryFg,
    '--secondary': muted,
    '--secondary-foreground': fg,
    '--muted': muted,
    '--muted-foreground': mutedFg,
    '--accent': accent,
    '--accent-foreground': fg,
    '--border': border,
    '--input': input,
    '--ring': ring,
    '--sidebar': sidebar,
    '--sidebar-foreground': fg,
    '--sidebar-primary': primary,
    '--sidebar-primary-foreground': primaryFg,
    '--sidebar-accent': accent,
    '--sidebar-accent-foreground': fg,
    '--sidebar-border': sidebarBorder,
    '--sidebar-ring': ring,
  };
}

/**
 * Renders a <style> tag that overrides the entire app's CSS custom properties
 * and ProseMirror hljs token colors based on the selected shiki code theme.
 * This gives a VS Code–like full-app theming experience.
 */
export function CodeThemeStyle() {
  const codeTheme = useSettingsStore((s) => s.codeTheme) as CodeThemeKey;

  const [highlighter, setHighlighter] = useState(getShikiHighlighterSync);
  useEffect(() => {
    if (highlighter) return;
    getShikiHighlighter().then(setHighlighter);
  }, [highlighter]);

  const css = useMemo(() => {
    if (!highlighter || codeTheme === 'github') return '';
    const pair = CODE_THEME_PAIRS[codeTheme];
    if (!pair) return '';

    let lightTheme: { fg?: string; bg?: string; settings: ThemeSettings[] };
    let darkTheme: { fg?: string; bg?: string; settings: ThemeSettings[] };
    try {
      lightTheme = highlighter.getTheme(pair.light);
      darkTheme = highlighter.getTheme(pair.dark);
    } catch {
      return '';
    }

    const lightSettings = lightTheme.settings || [];
    const darkSettings = darkTheme.settings || [];

    const lightBg = lightTheme.bg || '#ffffff';
    const lightFg = lightTheme.fg || '#333333';
    const darkBg = darkTheme.bg || '#1e1e1e';
    const darkFg = darkTheme.fg || '#d4d4d4';

    // Pick a primary accent from function/keyword token colors
    const lightPrimary =
      findScopeColor(lightSettings, ['entity.name.function', 'keyword', 'storage']) || mix(lightFg, lightBg, 0.3);
    const darkPrimary =
      findScopeColor(darkSettings, ['entity.name.function', 'keyword', 'storage']) || mix(darkFg, darkBg, 0.3);

    const lines: string[] = [];

    // ── App-wide CSS variable overrides ──
    const lightVars = generateAppVars({ bg: lightBg, fg: lightFg, primary: lightPrimary, settings: lightSettings });
    const darkVars = generateAppVars({ bg: darkBg, fg: darkFg, primary: darkPrimary, settings: darkSettings });

    lines.push(':root {');
    for (const [prop, val] of Object.entries(lightVars)) {
      lines.push(`  ${prop}: ${val};`);
    }
    lines.push('}');

    lines.push('.dark {');
    for (const [prop, val] of Object.entries(darkVars)) {
      lines.push(`  ${prop}: ${val};`);
    }
    lines.push('}');

    // ── Code block overrides (background + text color) ──
    const lightTokens = extractTokenColors(lightSettings);
    const darkTokens = extractTokenColors(darkSettings);

    const lightCodeBg = mix(lightBg, lightFg, 0.04);
    const darkCodeBg = mix(darkBg, darkFg, 0.06);
    lines.push(`.ProseMirror pre { background: ${lightCodeBg}; color: ${lightFg}; }`);
    lines.push(`.dark .ProseMirror pre { background: ${darkCodeBg}; color: ${darkFg}; }`);

    // Token colors
    for (const [cls, { fg, italic }] of lightTokens) {
      let rule = `color: ${fg}`;
      if (cls === 'comment' && italic) rule += '; font-style: italic';
      lines.push(`.ProseMirror pre .hljs-${cls} { ${rule}; }`);
    }
    for (const [cls, { fg, italic }] of darkTokens) {
      let rule = `color: ${fg}`;
      if (cls === 'comment' && italic) rule += '; font-style: italic';
      lines.push(`.dark .ProseMirror pre .hljs-${cls} { ${rule}; }`);
    }

    // ── Inline code overrides ──
    const lightInlineCodeBg = mix(lightBg, lightFg, 0.07);
    const darkInlineCodeBg = mix(darkBg, darkFg, 0.10);
    const lightInlineCodeFg = findScopeColor(lightSettings, ['string', 'constant']) || lightFg;
    const darkInlineCodeFg = findScopeColor(darkSettings, ['string', 'constant']) || darkFg;
    lines.push(`.ProseMirror code { background: ${lightInlineCodeBg}; color: ${lightInlineCodeFg}; }`);
    lines.push(`.dark .ProseMirror code { background: ${darkInlineCodeBg}; color: ${darkInlineCodeFg}; }`);

    // ── Comment/mark highlight overrides ──
    const [lr, lg, lb] = hexToRgb(lightPrimary);
    const [dr, dg, db] = hexToRgb(darkPrimary);

    // Light mode: subtle tint with dark text (already readable)
    lines.push(`.ProseMirror mark { background-color: rgba(${lr}, ${lg}, ${lb}, 0.15); color: ${lightFg}; }`);
    lines.push(`.ProseMirror mark.comment-active { background-color: rgba(${lr}, ${lg}, ${lb}, 0.30) !important; }`);
    lines.push(`.comment-highlight { background-color: rgba(${lr}, ${lg}, ${lb}, 0.12); border-bottom-color: rgba(${lr}, ${lg}, ${lb}, 0.5); }`);

    // Dark mode: solid pastel highlight with dark text for readability
    // Mix primary 45% toward white to guarantee a light-enough background
    const darkMarkBg = mix(darkPrimary, '#ffffff', 0.45);
    const darkMarkActiveBg = mix(darkPrimary, '#ffffff', 0.35);
    const darkMarkFg = luminance(darkMarkBg) > 0.3 ? '#1a1a1a' : darkFg;
    lines.push(`.dark .ProseMirror mark { background-color: ${darkMarkBg}; color: ${darkMarkFg}; }`);
    lines.push(`.dark .ProseMirror mark.comment-active { background-color: ${darkMarkActiveBg} !important; color: ${darkMarkFg} !important; }`);
    lines.push(`.dark .comment-highlight { background-color: rgba(${dr}, ${dg}, ${db}, 0.12); border-bottom-color: rgba(${dr}, ${dg}, ${db}, 0.4); }`);

    // ── Search match highlight overrides ──
    lines.push(`.ProseMirror .search-match { background-color: rgba(${lr}, ${lg}, ${lb}, 0.25); }`);
    lines.push(`.ProseMirror .search-match-active { background-color: rgba(${lr}, ${lg}, ${lb}, 0.50); box-shadow: 0 0 0 1px rgba(${lr}, ${lg}, ${lb}, 0.7); }`);
    const darkSearchBg = mix(darkPrimary, '#ffffff', 0.50);
    const darkSearchActiveBg = mix(darkPrimary, '#ffffff', 0.40);
    lines.push(`.dark .ProseMirror .search-match { background-color: ${darkSearchBg}; color: ${darkMarkFg}; }`);
    lines.push(`.dark .ProseMirror .search-match-active { background-color: ${darkSearchActiveBg}; color: ${darkMarkFg}; box-shadow: 0 0 0 1px ${mix(darkPrimary, '#ffffff', 0.30)}; }`);

    // ── Link color override ──
    const lightLinkColor = findScopeColor(lightSettings, ['markup.underline.link', 'string.other.link', 'entity.name.function']) || lightPrimary;
    const darkLinkColor = findScopeColor(darkSettings, ['markup.underline.link', 'string.other.link', 'entity.name.function']) || darkPrimary;
    lines.push(`.ProseMirror a { color: ${lightLinkColor}; }`);
    lines.push(`.dark .ProseMirror a { color: ${darkLinkColor}; }`);

    return lines.join('\n');
  }, [highlighter, codeTheme]);

  if (!css) return null;
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
