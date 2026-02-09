import { NextRequest } from 'next/server';
import { generateText } from 'ai';
import { getAIModel, getDefaultModel } from '@/lib/ai/providers';
import type { AIProvider } from '@/types';

export const maxDuration = 60;

const CHECK_DESCRIPTIONS: Record<string, string> = {
  grammar: 'Fix spelling and grammar errors',
  brevity: 'Omit needless words and reduce wordiness',
  cliches: 'Replace over-used phrases and cliches with fresh language',
  readability: 'Simplify convoluted sentences for better readability',
  'passive-voice': 'Convert passive voice to active voice',
  confidence: 'Remove excessive hedging (I think, probably, perhaps, etc.)',
  repetition: 'Identify and remove repeated words or phrases',
};

const CODE_CHECK_DESCRIPTIONS: Record<string, string> = {
  bugs: 'Find potential bugs, logic errors, off-by-one errors, null/undefined issues, and incorrect assumptions',
  security: 'Find security vulnerabilities: injection, XSS, CSRF, insecure defaults, hardcoded secrets, unsafe deserialization',
  performance: 'Find performance issues: unnecessary re-renders, N+1 queries, missing memoization, expensive operations in loops',
  'best-practices': 'Find violations of language/framework best practices, anti-patterns, and idiomatic improvements',
  complexity: 'Find overly complex code: deeply nested conditionals, long functions, high cyclomatic complexity',
  'error-handling': 'Find missing or inadequate error handling: uncaught exceptions, swallowed errors, missing validation',
};

const WRITING_SYSTEM_PROMPT = `You are a meticulous professional writing editor and proofreader. Your job is to find EVERY writing issue in the text based on the requested check categories.

Be thorough and critical. Good writers always have room for improvement. Look carefully for:
- Spelling mistakes, grammatical errors, punctuation issues
- Wordy phrases that can be shortened
- Cliches and overused expressions
- Complex sentences that could be simpler
- Passive voice constructions
- Hedging language (I think, probably, perhaps, maybe, seems, might)
- Repeated words or phrases nearby in the text

For EACH issue found, return a JSON object with these exact fields:
- "check": the check category string (e.g., "grammar", "brevity", "cliches", "readability", "passive-voice", "confidence", "repetition", "custom")
- "text": the exact original text that has the issue — copy it VERBATIM from the input, character-for-character
- "suggestion": the corrected/improved version of that text
- "explanation": a brief reason for the change (1 sentence)
- "severity": "error" for clear mistakes, "warning" for style improvements, "info" for minor suggestions

CRITICAL RULES:
1. You MUST return a valid JSON array and NOTHING else. No markdown formatting, no code blocks, no explanation text.
2. The "text" field MUST be an exact substring of the original text so it can be found and replaced.
3. Find at least a few issues if the text is more than a sentence. Be helpful, not lenient.
4. Limit to the 20 most important issues.`;

const CODE_SYSTEM_PROMPT = `You are a meticulous senior code reviewer. Your job is to find EVERY code issue based on the requested check categories.

Be thorough and critical. Even good code has room for improvement. Focus on actionable, specific issues.

For EACH issue found, return a JSON object with these exact fields:
- "check": the check category string (e.g., "bugs", "security", "performance", "best-practices", "complexity", "error-handling", "custom")
- "text": the exact original code that has the issue — copy it VERBATIM from the input, character-for-character (can be a single line or multi-line block)
- "suggestion": the corrected/improved version of that code
- "explanation": a brief reason for the change (1 sentence)
- "severity": "error" for bugs/security issues, "warning" for performance/best-practice issues, "info" for minor suggestions

CRITICAL RULES:
1. You MUST return a valid JSON array and NOTHING else. No markdown formatting, no code blocks, no explanation text.
2. The "text" field MUST be an exact substring of the original code so it can be found and replaced.
3. Find real, actionable issues — not stylistic nitpicks like missing semicolons or spacing.
4. Limit to the 20 most important issues.`;

export async function POST(request: NextRequest) {
  try {
    const { content, checks, customInstruction, provider, modelId, mode, filename } = await request.json();

    if (!content || !checks || checks.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Content and at least one check type are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const resolvedProvider = (provider || getDefaultModel().provider) as AIProvider;
    const resolvedModel = modelId || getDefaultModel().modelId;

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

    const isCodeMode = mode === 'code';
    const descriptions = isCodeMode ? CODE_CHECK_DESCRIPTIONS : CHECK_DESCRIPTIONS;

    // Truncate very large files to stay within token limits (~100K chars ≈ 25K tokens)
    const MAX_CONTENT_LENGTH = 100_000;
    let truncatedContent = content;
    let wasTruncated = false;
    if (content.length > MAX_CONTENT_LENGTH) {
      truncatedContent = content.slice(0, MAX_CONTENT_LENGTH);
      wasTruncated = true;
    }

    const checkDescriptions = checks
      .map((check: string) => {
        if (check === 'custom' && customInstruction) {
          return `- Custom: ${customInstruction}`;
        }
        return descriptions[check] ? `- ${check}: ${descriptions[check]}` : null;
      })
      .filter(Boolean)
      .join('\n');

    const systemPrompt = isCodeMode ? CODE_SYSTEM_PROMPT : WRITING_SYSTEM_PROMPT;
    const truncationNote = wasTruncated ? `\n\nNOTE: The content was truncated to the first ${MAX_CONTENT_LENGTH} characters. Only review the visible portion.` : '';
    const userMessage = isCodeMode
      ? `Review this ${filename ? `file (${filename})` : 'code'} for the following issues:\n${checkDescriptions}\n\nCode to review:\n\`\`\`\n${truncatedContent}\n\`\`\`${truncationNote}\n\nReturn ONLY a JSON array of issues (no other text):`
      : `Carefully analyze this text for the following writing issues. Find every instance:\n${checkDescriptions}\n\nText to analyze:\n"""\n${truncatedContent}\n"""${truncationNote}\n\nReturn ONLY a JSON array of issues (no other text):`;

    const result = await generateText({
      model: getAIModel(resolvedProvider, resolvedModel),
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userMessage,
        },
      ],
    });

    // Parse the JSON from the response
    let issues;
    try {
      const text = result.text.trim();
      // Strip markdown code block wrapper if present
      const cleaned = text.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
      // Try to find JSON array in the response even if there's extra text
      const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
      issues = JSON.parse(arrayMatch ? arrayMatch[0] : cleaned);
      if (!Array.isArray(issues)) issues = [];
    } catch (parseError) {
      console.error('Failed to parse AI checks response:', result.text.slice(0, 500));
      issues = [];
    }

    return new Response(JSON.stringify({ issues, truncated: wasTruncated }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('AI checks error:', error);
    return new Response(JSON.stringify({ error: 'AI checks request failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
