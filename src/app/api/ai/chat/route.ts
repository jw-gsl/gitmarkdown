import { NextRequest } from 'next/server';
import { streamText, stepCountIs } from 'ai';
import { getAIModel, getDefaultModel } from '@/lib/ai/providers';
import { aiTools } from '@/lib/ai/tools';
import type { AIProvider } from '@/types';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const { messages, provider, modelId, fileContext } = await request.json();

    const resolvedProvider = (provider || getDefaultModel().provider) as AIProvider;
    const resolvedModel = modelId || getDefaultModel().modelId;

    const systemMessage = `You are an AI writing assistant for GitMarkdown, a collaborative markdown editor. You help users write, edit, and improve their markdown documents.

${fileContext ? `The user is currently editing the following file:\n\n${fileContext}` : ''}

Guidelines:
- Be concise and helpful
- When suggesting edits, provide the exact text to change
- Format responses in markdown when appropriate
- If asked to generate diagrams, use Mermaid syntax
- When mentioning file changes, specify the exact file path and changes`;

    const result = streamText({
      model: getAIModel(resolvedProvider, resolvedModel),
      system: systemMessage,
      messages,
      tools: aiTools,
      stopWhen: stepCountIs(5),
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error('AI chat error:', error);
    return new Response(JSON.stringify({ error: 'AI request failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
