import { NextRequest } from 'next/server';
import { streamText } from 'ai';
import { getAIModel, getDefaultModel } from '@/lib/ai/providers';
import type { AIProvider } from '@/types';

export const maxDuration = 30;

const extToLang: Record<string, string> = {
  ts: 'TypeScript', tsx: 'TypeScript (React)', js: 'JavaScript', jsx: 'JavaScript (React)',
  py: 'Python', rb: 'Ruby', go: 'Go', rs: 'Rust', java: 'Java', c: 'C', cpp: 'C++',
  cs: 'C#', php: 'PHP', swift: 'Swift', kt: 'Kotlin', scala: 'Scala',
  sh: 'Shell', bash: 'Bash', zsh: 'Zsh', sql: 'SQL', lua: 'Lua', r: 'R',
  css: 'CSS', scss: 'SCSS', less: 'Less', html: 'HTML', xml: 'XML', svg: 'SVG',
  json: 'JSON', yaml: 'YAML', yml: 'YAML', toml: 'TOML', ini: 'INI',
  graphql: 'GraphQL', proto: 'Protobuf', dockerfile: 'Dockerfile', makefile: 'Makefile',
};

function detectLanguage(filename?: string): string | null {
  if (!filename) return null;
  const basename = filename.split('/').pop() || filename;
  const lower = basename.toLowerCase();
  if (lower === 'dockerfile') return 'Dockerfile';
  if (lower === 'makefile') return 'Makefile';
  const ext = basename.split('.').pop()?.toLowerCase();
  if (!ext) return null;
  return extToLang[ext] ?? null;
}

function isCodeFile(filename?: string): boolean {
  if (!filename) return false;
  const lang = detectLanguage(filename);
  if (!lang) return false;
  const proseFormats = new Set(['Markdown']);
  return !proseFormats.has(lang);
}

/** Detect structural context for the cursor position. */
function detectContext(before: string, after: string) {
  const lines = before.split('\n');
  const currentLine = lines[lines.length - 1] || '';
  const prevLine = lines.length >= 2 ? lines[lines.length - 2] : '';
  const trimmed = before.trimEnd();
  const lastChar = before.slice(-1);
  const afterFirstLine = after.split('\n')[0] || '';

  // String detection: count unescaped quotes on current line
  const singleQuotes = (currentLine.match(/(?:^|[^\\])'/g) || []).length;
  const doubleQuotes = (currentLine.match(/(?:^|[^\\])"/g) || []).length;
  const backticks = (currentLine.match(/(?:^|[^\\])`/g) || []).length;

  // Comment detection
  const trimmedLine = currentLine.trimStart();
  const isInLineComment = /^(\/\/|#|--|%)/.test(trimmedLine);
  const isInBlockComment = /\/\*(?!.*\*\/)/.test(before.slice(-200));

  return {
    currentLine,
    prevLine,
    isBlankLine: currentLine.trim() === '' && lines.length > 1,
    isAfterNewline: lastChar === '\n',
    isMidLine: currentLine.trim().length > 0,
    endsWithSentence: /[.!?]\s*$/.test(trimmed),
    isInList: /^(\s*[-*+]|\s*\d+[.)]) /.test(prevLine) || /^(\s*[-*+]|\s*\d+[.)]) /.test(currentLine),
    isAfterHeading: /^#{1,6}\s+/.test(prevLine),
    needsLeadingSpace: lastChar !== '' && !/\s/.test(lastChar),
    isAfterBlankLine: prevLine.trim() === '' && lines.length > 1,
    // New: end of file — no meaningful text after cursor
    isEndOfFile: after.trim().length === 0,
    // New: content exists after cursor on same line (mid-line insertion)
    hasSuffixOnLine: afterFirstLine.trim().length > 0,
    // New: inside an unclosed string literal
    isInsideString: singleQuotes % 2 !== 0 || doubleQuotes % 2 !== 0 || backticks % 2 !== 0,
    // New: inside a comment
    isInComment: isInLineComment || isInBlockComment,
    // New: inside an import block
    isInImports: /^(import |from |require\(|#include )/.test(trimmedLine) ||
                 /^(import |from |require\(|#include )/.test(prevLine.trimStart()),
    // New: current indentation level
    currentIndent: currentLine.search(/\S/) >= 0 ? currentLine.search(/\S/) : 0,
  };
}

export async function POST(request: NextRequest) {
  try {
    const { before, after, provider, modelId, filename } = await request.json();

    const resolvedProvider = (provider || getDefaultModel().provider) as AIProvider;
    const resolvedModel = modelId || getDefaultModel().modelId;

    // Validate API key exists for the selected provider
    if (resolvedProvider === 'anthropic' && !process.env.ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'Anthropic API key not configured. Add ANTHROPIC_API_KEY to .env.local' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (resolvedProvider === 'openai' && !process.env.OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured. Add OPENAI_API_KEY to .env.local' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const language = detectLanguage(filename);
    const isCode = isCodeFile(filename);
    const ctx = detectContext(before, after);

    // Trim trailing whitespace from prefix — Sourcegraph found this improves quality
    const trimmedBefore = before.replace(/[ \t]+$/, '');

    // Determine single-line vs multi-line mode
    const isSingleLine = ctx.hasSuffixOnLine || ctx.isInsideString;

    // Build context-aware structure hints
    const structureHints: string[] = [];

    if (isCode) {
      if (ctx.isInsideString) {
        structureHints.push('The cursor is inside a string literal. Complete the string content only — do not close the string or add code after it.');
      } else if (ctx.isInComment) {
        structureHints.push('The cursor is inside a comment. Continue the comment text naturally — do not add code.');
      } else if (ctx.isInImports) {
        structureHints.push('The cursor is in the import/require section. Predict the next import or the first line of code after imports.');
      } else if (ctx.needsLeadingSpace) {
        structureHints.push('The cursor is right after a token with no space. Add a space if syntactically needed.');
      } else if (ctx.isBlankLine) {
        structureHints.push('The cursor is on a blank line. Predict the next logical line of code based on surrounding context.');
      } else if (ctx.isAfterNewline) {
        structureHints.push('The cursor is at the start of a new line. Continue with properly indented code.');
      } else {
        structureHints.push('The cursor is after whitespace. Do NOT add extra spaces.');
      }

      if (ctx.hasSuffixOnLine) {
        structureHints.push('There is existing code after the cursor on this line. Your suggestion must fit WITHIN this line — do not add newlines.');
      }

      if (ctx.isEndOfFile) {
        structureHints.push('This is near the end of the file. Only suggest if there is a natural next addition; if the file looks complete, return minimal or nothing.');
      }
    } else {
      if (ctx.isBlankLine) {
        structureHints.push('The cursor is on a blank line (paragraph break). Start a NEW paragraph. Use proper capitalization.');
      } else if (ctx.isInList) {
        structureHints.push('The cursor is inside a list. Continue with the next list item or complete the current one, matching the list style.');
      } else if (ctx.isAfterHeading) {
        structureHints.push('The cursor is right after a heading. Start the first sentence of this section.');
      } else if (ctx.needsLeadingSpace) {
        structureHints.push('The cursor is right after a word with no space. Start your continuation with a space.');
      } else if (ctx.endsWithSentence && ctx.isMidLine) {
        structureHints.push('The previous text ends a sentence. Start a new sentence with proper capitalization.');
      } else if (ctx.isMidLine) {
        structureHints.push('Continue the current sentence naturally. Do NOT capitalize unless grammar requires it.');
      } else {
        structureHints.push('The cursor is after whitespace. Do NOT start with extra spaces.');
      }

      if (ctx.hasSuffixOnLine) {
        structureHints.push('There is existing text after the cursor on this line. Keep your suggestion short to flow naturally into it.');
      }

      if (ctx.isEndOfFile) {
        structureHints.push('This is near the end of the document. Only suggest if there is a natural continuation.');
      }
    }

    const lineLimit = isSingleLine ? 'Return only a single line (no newlines).' : '';

    const systemPrompt = isCode
      ? `You are an inline code completion engine. Output ONLY raw code to insert at the cursor.

RULES:
- Output ONLY the raw code to insert. No explanations, no markdown fences, no quotes, no meta-text.
- ${lineLimit || 'Keep suggestions short: 1-3 lines max. Favor precision over length.'}
- Match the existing indentation style (spaces vs tabs, indent width) exactly.
- Match naming conventions (camelCase, snake_case, etc.) used in the file.
- ${language ? `This is ${language}. Follow ${language} idioms.` : 'Follow the language conventions in the existing code.'}
- ${structureHints.join(' ')}
- CRITICAL: Your output is INSERTED at the █ cursor. NEVER repeat any text/code that already appears before or after the cursor.
- If code after the cursor provides context, flow naturally into it.
- Pay attention to unclosed brackets, parentheses, and string delimiters.
- For config files (.env, .yaml, .json, etc.), predict the next key/value based on existing patterns.
- If you are uncertain or the context is ambiguous, prefer a shorter, safer suggestion.
- NEVER output nothing meaningful — at minimum, complete the current token or statement.`
      : `You are an inline text completion engine for a markdown editor. Output ONLY raw text to insert at the cursor.

RULES:
- Output ONLY the raw text to insert. No explanations, no markdown fences, no quotes, no meta-text.
- ${lineLimit || 'Keep it short: 1-2 sentences max.'}
- Match the tone, style, and voice of the existing text.
- ${structureHints.join(' ')}
- CRITICAL: Your output is INSERTED at the █ cursor. NEVER repeat any text that already appears before or after the cursor.
- If text after the cursor provides context, flow naturally into it.
- For lists, match the existing marker style (-, *, 1., etc.) and indentation.
- Multi-line suggestions are allowed when context calls for it (e.g. next list item, new paragraph).
- If you are uncertain, prefer a shorter, safer suggestion.`;

    const currentLineHint = ctx.currentLine.trim()
      ? `\n[Current line: ${ctx.currentLine}]`
      : '';

    const result = streamText({
      model: getAIModel(resolvedProvider, resolvedModel),
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Complete at █. Output ONLY raw ${isCode ? 'code' : 'text'} to insert:${currentLineHint}

${trimmedBefore}█${after}`,
        },
      ],
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error('AI completion error:', error);
    return new Response(JSON.stringify({ error: 'AI completion request failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
