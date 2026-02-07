import { NextRequest } from 'next/server';
import { streamText, stepCountIs, convertToModelMessages } from 'ai';
import { getAIModel, getDefaultModel } from '@/lib/ai/providers';
import { aiTools } from '@/lib/ai/tools';
import type { AIProvider } from '@/types';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const { messages, provider, modelId, fileContext, personaInstructions, personaName } = await request.json();

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

    const systemMessage = `You are an AI writing assistant for GitMarkdown, a collaborative markdown editor with GitHub sync.

${fileContext ? `<document>\n${fileContext}\n</document>` : ''}

## Your capabilities
You can help users write, edit, and improve their markdown documents. You have access to the \`editFile\` tool.

## CRITICAL: When to use the editFile tool
You MUST use the \`editFile\` tool whenever the user asks you to:
- Edit, modify, rewrite, fix, change, or update any text
- Fix grammar, spelling, or punctuation
- Make text more concise, formal, casual, funny, etc.
- Translate text to another language
- Expand or shorten content
- Restructure or reorganize text
- Add, remove, or modify headings, lists, links, etc.

When using editFile:
- \`oldText\` must be an EXACT verbatim substring copied from the <document> above
- If the user references a partial or truncated snippet of text (e.g. "cate images" from "duplicate images"), find the FULL sentence or passage in the document that contains it and use that as oldText
- \`newText\` is your full replacement for that passage
- The user will see a visual diff and can accept, edit, or reject your change
- You can make multiple editFile calls in one response to change different parts
- After calling editFile, respond briefly (e.g. "Here's the edit:") — do NOT repeat the changes in text

## Handling "Regarding this text: ..." messages
When the user's message starts with 'Regarding this text: "..."', they selected that text in the editor and want you to work with it. The quoted text may be a partial selection. Find the containing sentence/paragraph in the <document> and use that as oldText in your editFile call.

## When NOT to use editFile
- When the user is just asking questions about the content (answer in text)
- When the user wants a summary or analysis (respond in text)
- When the user asks you to generate new standalone content not related to editing the current document (respond in text with the content)

## General guidelines
- Be concise and helpful
- Format responses in markdown when appropriate
- If asked to generate diagrams, use Mermaid syntax in a code block
- For questions about the document, reference specific sections
- Always prefer using the editFile tool over just suggesting changes in text${personaInstructions ? `\n\n## Persona: ${personaName || 'Custom'}\nAdapt your tone and style to match these instructions:\n${personaInstructions}` : ''}`;

    // DefaultChatTransport sends UIMessage[] (with `parts` arrays).
    // streamText expects ModelMessage[] — convert first.
    const modelMessages = await convertToModelMessages(messages, {
      tools: aiTools,
    });

    const result = streamText({
      model: getAIModel(resolvedProvider, resolvedModel),
      system: systemMessage,
      messages: modelMessages,
      tools: aiTools,
      stopWhen: stepCountIs(5),
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
