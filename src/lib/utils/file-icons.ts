export function getFileIcon(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const iconMap: Record<string, string> = {
    md: 'markdown',
    mdx: 'markdown',
    ts: 'typescript',
    tsx: 'react',
    js: 'javascript',
    jsx: 'react',
    json: 'json',
    css: 'css',
    scss: 'sass',
    html: 'html',
    yml: 'yaml',
    yaml: 'yaml',
    py: 'python',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    toml: 'settings',
    lock: 'lock',
    gitignore: 'git',
    env: 'env',
    svg: 'image',
    png: 'image',
    jpg: 'image',
    jpeg: 'image',
    gif: 'image',
  };
  return iconMap[ext || ''] || 'file';
}

export function getLanguageFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const langMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'tsx',
    js: 'javascript',
    jsx: 'jsx',
    py: 'python',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    css: 'css',
    scss: 'scss',
    html: 'html',
    md: 'markdown',
    mdx: 'mdx',
    sql: 'sql',
    sh: 'bash',
    bash: 'bash',
    zsh: 'bash',
  };
  return langMap[ext || ''] || 'plaintext';
}
