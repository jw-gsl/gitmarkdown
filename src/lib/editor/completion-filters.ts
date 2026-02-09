/**
 * Client-side post-processing pipeline for AI completions.
 * Cleans, validates, and filters raw LLM output before showing as ghost text.
 */

/** Strip leading overlap: if the completion repeats the tail of `before`, trim it. */
export function stripPrefixOverlap(before: string, completion: string): string {
  if (!completion || !before) return completion;
  const maxCheck = Math.min(before.length, completion.length, 50);
  for (let len = maxCheck; len >= 2; len--) {
    const tail = before.slice(-len);
    if (completion.startsWith(tail)) {
      return completion.slice(len);
    }
  }
  // Check: does the last word of `before` appear at the start of completion?
  const lastWord = before.match(/(\S+)\s*$/)?.[1];
  if (lastWord && lastWord.length >= 2 && completion.startsWith(lastWord)) {
    return completion.slice(lastWord.length);
  }
  return completion;
}

/** Strip trailing overlap: if the completion ends with text that starts the `after`. */
export function stripSuffixOverlap(completion: string, after: string): string {
  if (!completion || !after) return completion;
  const maxCheck = Math.min(completion.length, after.length, 50);
  for (let len = maxCheck; len >= 2; len--) {
    const completionTail = completion.slice(-len);
    if (after.startsWith(completionTail)) {
      return completion.slice(0, -len);
    }
  }
  return completion;
}

/** Strip meta-text that instruction-tuned models sometimes emit. */
export function stripInstructionBleed(completion: string): string {
  let result = completion;
  // Remove "Here's the completion:" prefixes
  result = result.replace(
    /^(Here('s| is) (the |my |your )?(completion|suggestion|code|text|continuation)[:\s]*\n?)/i,
    ''
  );
  // Remove opening/closing code fences
  result = result.replace(/^```[\w]*\n?/, '');
  result = result.replace(/\n?```\s*$/, '');
  // Remove "I would suggest..." prefixes
  result = result.replace(
    /^(I would suggest|I think|The next|You could|You might)[^.\n]*[.:]\s*/i,
    ''
  );
  // Remove comment-style prefixes like "// completion:"
  result = result.replace(/^\s*\/\/\s*(?:completion|suggestion|insert)[:\s]*/i, '');
  return result;
}

/** Detect and truncate self-repeating patterns in the completion. */
export function truncateSelfRepetition(completion: string): string {
  const lines = completion.split('\n');
  if (lines.length < 3) return completion;

  // Check for the same line repeated 3+ times
  for (let i = 2; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (
      trimmed.length > 0 &&
      trimmed === lines[i - 1].trim() &&
      trimmed === lines[i - 2].trim()
    ) {
      return lines.slice(0, i - 1).join('\n');
    }
  }

  // Check for repeating blocks (period 1-4 lines)
  for (let period = 1; period <= 4; period++) {
    if (lines.length >= period * 3) {
      const block1 = lines.slice(-period * 2, -period).join('\n');
      const block2 = lines.slice(-period).join('\n');
      if (block1 === block2 && block1.trim().length > 0) {
        return lines.slice(0, -period).join('\n');
      }
    }
  }

  return completion;
}

/** Remove lines from the completion that already exist in the document. */
export function removeRepeatedLines(
  completion: string,
  before: string,
  after: string
): string {
  const existingLines = new Set(
    [...before.split('\n'), ...after.split('\n')]
      .map((l) => l.trim())
      .filter((l) => l.length > 8)
  );

  const completionLines = completion.split('\n');
  const filtered: string[] = [];
  let consecutiveRepeats = 0;

  for (const line of completionLines) {
    if (existingLines.has(line.trim()) && line.trim().length > 8) {
      consecutiveRepeats++;
      if (consecutiveRepeats >= 2) break; // Stop if repeating existing content
    } else {
      consecutiveRepeats = 0;
      filtered.push(line);
    }
  }

  return filtered.join('\n');
}

/** Truncate the completion based on indentation scope (code files). */
export function truncateByIndentation(
  completion: string,
  currentIndent: number
): string {
  const lines = completion.split('\n');
  if (lines.length <= 1) return completion;

  const result: string[] = [lines[0]];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    // Allow blank lines
    if (line.trim() === '') {
      result.push(line);
      continue;
    }
    const lineIndent = line.search(/\S/);
    if (lineIndent === -1) {
      result.push(line);
      continue;
    }
    // If line goes back to or past the original indent level
    // and it's not a closing bracket, stop
    if (lineIndent <= currentIndent && !/^\s*[}\])]/.test(line)) {
      break;
    }
    result.push(line);
  }

  return result.join('\n');
}

/** Enforce maximum line count. */
export function enforceLineLimit(
  completion: string,
  maxLines: number
): string {
  const lines = completion.split('\n');
  if (lines.length > maxLines) {
    return lines.slice(0, maxLines).join('\n');
  }
  return completion;
}

/** Quality gate: should this completion be shown at all? */
export function shouldShowCompletion(completion: string): boolean {
  const trimmed = completion.trim();
  // Too short to be useful
  if (trimmed.length < 2) return false;
  // Only whitespace
  if (!trimmed) return false;
  // Suspiciously long
  if (completion.length > 1000) return false;
  // Contains obvious meta-text markers
  if (/^(Here|I |Note:|Warning:|```)/i.test(trimmed)) return false;
  // Is just punctuation
  if (/^[.,;:!?)\]}>'"]+$/.test(trimmed)) return false;
  return true;
}

/**
 * Full post-processing pipeline. Run on raw LLM output before displaying.
 * Returns the cleaned text, or null if the completion should not be shown.
 */
export function processCompletion(
  raw: string,
  before: string,
  after: string,
  opts: { isCode?: boolean; currentIndent?: number } = {}
): string | null {
  let text = raw;

  // 1. Strip instruction bleed (fences, "Here is...", etc.)
  text = stripInstructionBleed(text);

  // 2. Strip prefix overlap
  text = stripPrefixOverlap(before, text);

  // 3. Strip suffix overlap
  text = stripSuffixOverlap(text, after);

  // 4. Remove lines that already exist in the document
  text = removeRepeatedLines(text, before, after);

  // 5. Truncate self-repetition
  text = truncateSelfRepetition(text);

  // 6. Indentation-based truncation (code only)
  if (opts.isCode && opts.currentIndent !== undefined) {
    text = truncateByIndentation(text, opts.currentIndent);
  }

  // 7. Enforce line limit
  const maxLines = opts.isCode ? 5 : 3;
  text = enforceLineLimit(text, maxLines);

  // 8. Quality gate
  if (!shouldShowCompletion(text)) return null;

  return text;
}
