export function extractTitle(markdown: string): string | null {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

export function extractDescription(markdown: string): string | null {
  const lines = markdown.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('---') && !trimmed.startsWith('>')) {
      return trimmed.slice(0, 160);
    }
  }
  return null;
}

export function extractHeadings(markdown: string): Array<{ level: number; text: string }> {
  const headings: Array<{ level: number; text: string }> = [];
  const regex = /^(#{1,6})\s+(.+)$/gm;
  let match;
  while ((match = regex.exec(markdown)) !== null) {
    headings.push({
      level: match[1].length,
      text: match[2].trim(),
    });
  }
  return headings;
}

export function countWords(markdown: string): number {
  const text = markdown
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]*`/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#*_~>`\-|]/g, '')
    .trim();
  return text.split(/\s+/).filter(Boolean).length;
}

export function estimateReadingTime(markdown: string, wordsPerMinute = 200): number {
  const words = countWords(markdown);
  return Math.max(1, Math.ceil(words / wordsPerMinute));
}
