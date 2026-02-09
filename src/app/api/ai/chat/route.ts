import { NextRequest } from 'next/server';
import { streamText, stepCountIs, convertToModelMessages } from 'ai';
import { getAIModel, getDefaultModel, hasApiKey } from '@/lib/ai/providers';
import { checkRateLimit } from '@/lib/auth/rate-limit';
import { createAllTools, aiTools } from '@/lib/ai/tools';
import { authenticateRequest } from '@/lib/auth/api-auth';
import type { AIProvider } from '@/types';

export const maxDuration = 60;

/** Map file extension to a language name. */
function getLanguageFromPath(filePath: string): string | null {
  const ext = filePath.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    ts: 'TypeScript', tsx: 'TypeScript (React)', js: 'JavaScript', jsx: 'JavaScript (React)',
    py: 'Python', rb: 'Ruby', go: 'Go', rs: 'Rust', java: 'Java', kt: 'Kotlin',
    swift: 'Swift', c: 'C', cpp: 'C++', h: 'C/C++ Header', cs: 'C#',
    css: 'CSS', scss: 'SCSS', less: 'Less', html: 'HTML', vue: 'Vue',
    json: 'JSON', yaml: 'YAML', yml: 'YAML', toml: 'TOML', xml: 'XML',
    sql: 'SQL', sh: 'Shell', bash: 'Bash', zsh: 'Zsh',
    dockerfile: 'Dockerfile', makefile: 'Makefile',
  };
  if (!ext) return null;
  return map[ext] ?? null;
}

/** Detect file type from the fileContext string. */
function detectFileType(fileContext: string | undefined): { fileType: 'code' | 'markdown' | 'unknown'; language: string | null; filePath: string | null } {
  if (!fileContext) return { fileType: 'unknown', language: null, filePath: null };
  const match = fileContext.match(/^Current file \(([^)]+)\):/m);
  if (!match) return { fileType: 'unknown', language: null, filePath: null };
  const filePath = match[1];
  const ext = filePath.split('.').pop()?.toLowerCase();
  const mdExts = ['md', 'mdx', 'markdown'];
  if (ext && mdExts.includes(ext)) return { fileType: 'markdown', language: null, filePath };
  const lang = getLanguageFromPath(filePath);
  if (lang) return { fileType: 'code', language: lang, filePath };
  return { fileType: 'unknown', language: null, filePath };
}

export async function POST(request: NextRequest) {
  try {
    const {
      messages, provider, modelId, fileContext, personaInstructions, personaName,
      owner, repo, branch, fileTree, userApiKey,
    } = await request.json();

    const resolvedProvider = (provider || getDefaultModel().provider) as AIProvider;
    const resolvedModel = modelId || getDefaultModel().modelId;

    // Validate API key availability
    if (!hasApiKey(resolvedProvider, userApiKey)) {
      return new Response(
        JSON.stringify({ error: 'NO_API_KEY', message: `No ${resolvedProvider === 'anthropic' ? 'Anthropic' : 'OpenAI'} API key configured. Add your key in Settings → AI.` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Authenticate and get GitHub token for server-side tools
    let auth: Awaited<ReturnType<typeof authenticateRequest>> = null;
    try {
      auth = await authenticateRequest(request);
    } catch (authErr: any) {
      console.warn('[AI Chat] Auth failed:', authErr?.message ?? authErr);
    }
    const githubToken = auth?.githubToken ?? '';

    // Rate limit: 20 requests/min per user, burst of 20
    const rateLimitId = auth?.userId || request.headers.get('x-forwarded-for') || 'anonymous';
    const rateLimitResponse = checkRateLimit(`ai-chat:${rateLimitId}`, { maxTokens: 20, refillRate: 20 / 60 });
    if (rateLimitResponse) return rateLimitResponse;

    console.log('[AI Chat] Request:', {
      provider: resolvedProvider,
      model: resolvedModel,
      owner: owner || '(none)',
      repo: repo || '(none)',
      branch: branch || '(none)',
      hasFileContext: !!fileContext,
      hasFileTree: !!fileTree,
      authSuccess: !!auth,
      hasGithubToken: !!githubToken,
      githubTokenLength: githubToken.length,
    });

    // Build dynamic tools with server context
    const tools = createAllTools({
      owner: owner || '',
      repo: repo || '',
      branch: branch || 'main',
      githubToken,
    });

    const { fileType, language } = detectFileType(fileContext);

    // Dynamic guidance based on file type
    let fileGuidance: string;
    if (fileType === 'code') {
      fileGuidance =
        `This is a code file (${language ?? 'unknown language'}). ` +
        'Before writing new code, study the patterns already in the file — naming conventions, import style, indentation, error handling. ' +
        'Match them exactly. Never introduce a new pattern without reason. ' +
        'Use editFile for targeted fixes, writeFile only for major restructuring.';
    } else if (fileType === 'markdown') {
      fileGuidance =
        'This is a markdown document. Maintain heading hierarchy, preserve front matter, match list styles and formatting conventions.';
    } else {
      fileGuidance =
        'Analyze the file format and maintain its conventions.';
    }

    // Build file tree context if available
    const fileTreeContext = fileTree
      ? `\n\n<file_tree>\n${fileTree}\n</file_tree>`
      : '';

    const systemMessage = `You are an AI assistant for GitMarkdown, a collaborative editor with GitHub sync.

${fileContext ? `<document>\n${fileContext}\n</document>` : ''}${fileTreeContext}

## Tools

### Editing tools
- **editFile**: Targeted find-and-replace. \`oldText\` must be an EXACT verbatim substring from the <document>. If the user references a partial snippet, find the FULL passage containing it. Best for: targeted fixes, renaming, updating paragraphs.
- **writeFile**: Complete file rewrite. Provide the ENTIRE new content. Only use when editFile would require too many individual changes.
- **createFile**: Create a new file. Provide path and complete content.
- **renameFile**: Rename or move a file. Provide old and new paths.
- **deleteFile**: Delete a file. Only when explicitly asked.

### Discovery tools
- **readFile**: Read any file from the repo by path. Use to check imports, related code, or referenced files before making changes.
- **searchFiles**: Search for code or text across the repo. Use to find usages, definitions, or related files.
- **listFiles**: List files in a directory. Use to discover project structure.

### External tools
- **fetchURL**: Fetch a URL and return content as text. Use for importing articles, referencing docs, or checking external resources.
- **webSearch**: Search the web for current information, documentation, or references.

### Git tools
- **commitChanges**: Propose committing pending changes with a message. The user reviews and confirms.
- **createBranch**: Propose creating a new branch. The user reviews and confirms.
- **getBranches**: List repository branches. Use to discover available branches.
- **getCollaborators**: List repository collaborators. Use for @mentions or understanding who has access.

### UI tools
- **suggestResponses**: Show 2-4 quick-reply buttons after your response. Use when there are clear next steps.

## Response rules

1. **Be concise.** After using a tool, respond in 1 sentence or less. Do NOT repeat the changes in text.
2. **No preambles.** Never start with "Sure!", "Of course!", "I'll help with that", "Here's what I'll do", or similar.
3. **No tool name mentions.** Never say "I'll use editFile" or "I'll use searchFiles" — instead describe what you're doing naturally, or just do it silently.
4. **Tools over text.** When the user asks to change something, use tools. Do not describe changes in text and ask "would you like me to apply this?"
5. **No post-explanations.** After applying an edit, stop. Don't explain what you just did unless asked.
6. **Discussion vs. action.** If the user asks a question (what, why, how, explain, summarize) → respond in text. If they give an instruction (fix, change, add, rewrite, create, update, improve, delete, rename, move) → use tools.
7. **Retry protection.** If an edit is rejected or fails to match, do not retry the same approach. Try a different strategy or ask for clarification.
8. **Multiple edits.** You can make multiple tool calls in one response for different parts of the file.
9. **Analyze current file directly.** When asked to find bugs, review, or analyze the current file, read the <document> content above and respond in text. Do NOT use searchFiles for this — the file content is already provided. Only use searchFiles when you need to find code across other files in the repo.
10. **searchFiles limitations.** GitHub code search may not index all repos or file types. If a search returns 0 results, fall back to readFile for specific paths or analyze the <document> directly.

## Handling "Regarding this text: ..." messages
When the user's message starts with 'Regarding this text: "..."', they selected that text in the editor. Find the containing passage in the <document> and use that as oldText in editFile.

## File-specific guidance
${fileGuidance}

## Multi-step operations
For complex changes, briefly state what you're doing:
- Done: Fixed the import → use past tense, 1 line
- Next: Updating the component → use present tense, 1 line
Keep progress updates under 10 words each.

## General
- Use markdown formatting in text responses
- For diagrams, use Mermaid syntax in a code block
- For code files: match existing style exactly — study the file first
- Use suggestResponses after explanations or when multiple next steps are possible${personaInstructions ? `\n\n## Persona: ${personaName || 'Custom'}\n${personaInstructions}` : ''}`;

    const modelMessages = await convertToModelMessages(messages, { tools: aiTools });

    const result = streamText({
      model: getAIModel(resolvedProvider, resolvedModel, userApiKey),
      system: systemMessage,
      messages: modelMessages,
      tools,
      stopWhen: stepCountIs(10),
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error('AI chat error:', error);
    return new Response(JSON.stringify({ error: 'AI request failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
