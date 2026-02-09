import { createHighlighter, type BundledLanguage, type BundledTheme } from 'shiki';

export type CodeThemeKey =
  | 'github' | 'catppuccin' | 'one' | 'vitesse' | 'rose-pine'
  | 'solarized' | 'min' | 'dracula' | 'night-owl' | 'tokyo-night'
  | 'nord' | 'ayu' | 'everforest' | 'gruvbox' | 'material'
  | 'slack' | 'poimandres' | 'vesper';

export const CODE_THEME_PAIRS: Record<CodeThemeKey, { label: string; light: BundledTheme; dark: BundledTheme }> = {
  github:      { label: 'GitHub',      light: 'github-light',         dark: 'github-dark' },
  catppuccin:  { label: 'Catppuccin',  light: 'catppuccin-latte',     dark: 'catppuccin-mocha' },
  one:         { label: 'One',         light: 'one-light',            dark: 'one-dark-pro' },
  vitesse:     { label: 'Vitesse',     light: 'vitesse-light',        dark: 'vitesse-dark' },
  'rose-pine': { label: 'Rosé Pine',   light: 'rose-pine-dawn',       dark: 'rose-pine' },
  solarized:   { label: 'Solarized',   light: 'solarized-light',      dark: 'solarized-dark' },
  min:         { label: 'Min',         light: 'min-light',            dark: 'min-dark' },
  dracula:     { label: 'Dracula',     light: 'github-light',         dark: 'dracula' },
  'night-owl': { label: 'Night Owl',   light: 'night-owl-light',      dark: 'night-owl' },
  'tokyo-night': { label: 'Tokyo Night', light: 'github-light',       dark: 'tokyo-night' },
  nord:        { label: 'Nord',        light: 'github-light',         dark: 'nord' },
  ayu:         { label: 'Ayu',         light: 'ayu-light',            dark: 'ayu-dark' },
  everforest:  { label: 'Everforest',  light: 'everforest-light',     dark: 'everforest-dark' },
  gruvbox:     { label: 'Gruvbox',     light: 'gruvbox-light-medium', dark: 'gruvbox-dark-medium' },
  material:    { label: 'Material',    light: 'material-theme-lighter', dark: 'material-theme-ocean' },
  slack:       { label: 'Slack',       light: 'slack-ochin',          dark: 'slack-dark' },
  poimandres:  { label: 'Poimandres',  light: 'github-light',         dark: 'poimandres' },
  vesper:      { label: 'Vesper',      light: 'github-light',         dark: 'vesper' },
};

const ALL_THEMES = [...new Set(
  Object.values(CODE_THEME_PAIRS).flatMap(p => [p.light, p.dark])
)] as BundledTheme[];

const LANGS: BundledLanguage[] = [
  'typescript', 'javascript', 'python', 'json', 'yaml', 'html', 'css',
  'bash', 'go', 'rust', 'java', 'ruby', 'php', 'sql', 'xml', 'cpp',
  'c', 'csharp', 'swift', 'kotlin', 'scala', 'scss', 'less', 'lua',
  'perl', 'r', 'diff', 'dockerfile', 'makefile', 'ini', 'toml',
  'graphql', 'powershell',
];

type ShikiHighlighter = Awaited<ReturnType<typeof createHighlighter>>;

let instance: ShikiHighlighter | null = null;
let loading: Promise<ShikiHighlighter> | null = null;

export function getShikiHighlighter(): Promise<ShikiHighlighter> {
  if (instance) return Promise.resolve(instance);
  if (loading) return loading;

  loading = createHighlighter({
    themes: ALL_THEMES,
    langs: LANGS,
  }).then((h) => {
    instance = h;
    return h;
  });

  return loading;
}

export function getShikiHighlighterSync(): ShikiHighlighter | null {
  return instance;
}

/**
 * Highlight code and return the inner HTML of the <code> element.
 * Returns null if highlighting fails.
 */
export function highlightCode(
  highlighter: ShikiHighlighter,
  code: string,
  lang: string | null,
  themeKey: CodeThemeKey,
): string | null {
  const pair = CODE_THEME_PAIRS[themeKey];
  if (!pair) return null;

  try {
    const html = highlighter.codeToHtml(code, {
      lang: (lang || 'text') as BundledLanguage,
      themes: { light: pair.light, dark: pair.dark },
      defaultColor: false,
    });
    // Extract innerHTML of <code>...</code>
    const match = html.match(/<code>([\s\S]*)<\/code>/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}
