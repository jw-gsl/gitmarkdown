/**
 * Position mapping between GitMarkdown character offsets and GitHub line numbers.
 *
 * GitMarkdown comments use character offsets (anchorStart/anchorEnd) + anchorText.
 * GitHub PR review comments use line numbers in the file.
 */

/**
 * Convert a character offset to a 1-based line number.
 */
export function charOffsetToLineNumber(fileContent: string, charOffset: number): number {
  const clamped = Math.max(0, Math.min(charOffset, fileContent.length));
  const before = fileContent.slice(0, clamped);
  return before.split('\n').length;
}

/**
 * Convert a 1-based line number to the character offset of the start of that line.
 */
export function lineNumberToCharOffset(fileContent: string, lineNumber: number): number {
  const lines = fileContent.split('\n');
  let offset = 0;
  for (let i = 0; i < Math.min(lineNumber - 1, lines.length); i++) {
    offset += lines[i].length + 1; // +1 for the \n
  }
  return offset;
}

/**
 * Find anchorText in markdown content and return the GitHub line number.
 * When multiple occurrences exist, pick the one closest to hintOffset.
 */
export function findAnchorInMarkdown(
  markdownContent: string,
  anchorText: string,
  hintOffset?: number
): { line: number; startLine?: number } | null {
  if (!anchorText) return null;

  // Find all occurrences
  const occurrences: number[] = [];
  let searchStart = 0;
  while (true) {
    const idx = markdownContent.indexOf(anchorText, searchStart);
    if (idx === -1) break;
    occurrences.push(idx);
    searchStart = idx + 1;
  }

  if (occurrences.length === 0) return null;

  // Pick the one closest to hintOffset, or the first
  let bestIdx = occurrences[0];
  if (hintOffset !== undefined && occurrences.length > 1) {
    let bestDist = Math.abs(occurrences[0] - hintOffset);
    for (const occ of occurrences) {
      const dist = Math.abs(occ - hintOffset);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = occ;
      }
    }
  }

  const endIdx = bestIdx + anchorText.length;
  const endLine = charOffsetToLineNumber(markdownContent, endIdx);
  const startLine = charOffsetToLineNumber(markdownContent, bestIdx);

  // GitHub uses `line` for the end line and `start_line` when it spans multiple lines
  if (startLine === endLine) {
    return { line: endLine };
  }
  return { line: endLine, startLine };
}

/**
 * Convert a GitHub review comment (line number + diff_hunk) to an anchor
 * suitable for GitMarkdown's comment system.
 */
export function githubCommentToAnchor(
  fileContent: string,
  line: number | null,
  diffHunk: string | null
): { anchorStart: number; anchorEnd: number; anchorText: string } {
  if (!line || line < 1) {
    // File-level comment with no line info
    return { anchorStart: 0, anchorEnd: 0, anchorText: '' };
  }

  const lines = fileContent.split('\n');
  const lineIdx = Math.min(line - 1, lines.length - 1);
  const lineText = lines[lineIdx] ?? '';

  const anchorStart = lineNumberToCharOffset(fileContent, line);
  const anchorEnd = anchorStart + lineText.length;
  const anchorText = lineText.trim();

  return { anchorStart, anchorEnd, anchorText };
}

/**
 * Map GitMarkdown emoji to GitHub's supported reaction content types.
 * GitHub only supports 8 reaction types. Returns null for unsupported emoji.
 */
const EMOJI_TO_GITHUB: Record<string, string> = {
  '\uD83D\uDC4D': '+1',       // 👍
  '\uD83D\uDC4E': '-1',       // 👎
  '\uD83D\uDE04': 'laugh',    // 😄
  '\uD83D\uDE15': 'confused', // 😕
  '\u2764\uFE0F': 'heart',    // ❤️
  '\u2764': 'heart',          // ❤ (without variation selector)
  '\uD83C\uDF89': 'hooray',   // 🎉
  '\uD83D\uDE80': 'rocket',   // 🚀
  '\uD83D\uDC40': 'eyes',     // 👀
};

const GITHUB_TO_EMOJI: Record<string, string> = {
  '+1': '\uD83D\uDC4D',
  '-1': '\uD83D\uDC4E',
  'laugh': '\uD83D\uDE04',
  'confused': '\uD83D\uDE15',
  'heart': '\u2764\uFE0F',
  'hooray': '\uD83C\uDF89',
  'rocket': '\uD83D\uDE80',
  'eyes': '\uD83D\uDC40',
};

export function emojiToGitHubReaction(emoji: string): string | null {
  return EMOJI_TO_GITHUB[emoji] ?? null;
}

export function githubReactionToEmoji(reaction: string): string | null {
  return GITHUB_TO_EMOJI[reaction] ?? null;
}
