const extensionToLanguage: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  py: 'python',
  rb: 'ruby',
  go: 'go',
  rs: 'rust',
  java: 'java',
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  hpp: 'cpp',
  cs: 'csharp',
  php: 'php',
  swift: 'swift',
  kt: 'kotlin',
  scala: 'scala',
  json: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'ini',
  ini: 'ini',
  xml: 'xml',
  html: 'xml',
  htm: 'xml',
  svg: 'xml',
  css: 'css',
  scss: 'scss',
  less: 'less',
  sql: 'sql',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  fish: 'bash',
  ps1: 'powershell',
  r: 'r',
  lua: 'lua',
  perl: 'perl',
  pl: 'perl',
  diff: 'diff',
  graphql: 'graphql',
  gql: 'graphql',
  proto: 'protobuf',
  dockerfile: 'dockerfile',
  makefile: 'makefile',
};

const specialFilenames: Record<string, string> = {
  Dockerfile: 'dockerfile',
  Makefile: 'makefile',
  Rakefile: 'ruby',
  Gemfile: 'ruby',
  Vagrantfile: 'ruby',
};

const imageExtensions = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'bmp', 'svg',
]);

export function getLanguageForFile(filename: string): string | null {
  // Check special filenames first
  const basename = filename.split('/').pop() || filename;
  if (specialFilenames[basename]) return specialFilenames[basename];

  const ext = basename.split('.').pop()?.toLowerCase();
  if (!ext) return null;

  return extensionToLanguage[ext] ?? null;
}

export function isImageFile(filename: string): boolean {
  const ext = (filename.split('.').pop() || '').toLowerCase();
  return imageExtensions.has(ext);
}

export function getLanguageDisplayName(language: string | null): string {
  if (!language) return 'Plain Text';
  const displayNames: Record<string, string> = {
    typescript: 'TypeScript',
    javascript: 'JavaScript',
    python: 'Python',
    ruby: 'Ruby',
    go: 'Go',
    rust: 'Rust',
    java: 'Java',
    c: 'C',
    cpp: 'C++',
    csharp: 'C#',
    php: 'PHP',
    swift: 'Swift',
    kotlin: 'Kotlin',
    scala: 'Scala',
    json: 'JSON',
    yaml: 'YAML',
    ini: 'TOML',
    xml: 'XML',
    css: 'CSS',
    scss: 'SCSS',
    less: 'Less',
    sql: 'SQL',
    bash: 'Shell',
    powershell: 'PowerShell',
    r: 'R',
    lua: 'Lua',
    perl: 'Perl',
    diff: 'Diff',
    graphql: 'GraphQL',
    protobuf: 'Protobuf',
    dockerfile: 'Dockerfile',
    makefile: 'Makefile',
  };
  return displayNames[language] || language;
}
