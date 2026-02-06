import { NextRequest } from 'next/server';
import { streamText } from 'ai';
import { getAIModel, getDefaultModel } from '@/lib/ai/providers';
import type { AIProvider } from '@/types';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const { content, diagramType, provider, modelId } = await request.json();

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

    const result = streamText({
      model: getAIModel(resolvedProvider, resolvedModel),
      system: `You are a Mermaid diagram generator. Generate valid Mermaid diagram syntax based on the provided content.

Rules:
- Return ONLY the Mermaid code block content (no \`\`\`mermaid wrapper)
- Ensure the diagram is valid Mermaid syntax
- Keep diagrams clear and readable
- Use descriptive labels for nodes`,
      messages: [
        {
          role: 'user',
          content: `Generate a ${diagramType || 'flowchart'} Mermaid diagram based on this content:

${content}

Return only the Mermaid diagram code:`,
        },
      ],
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error('AI mermaid error:', error);
    return new Response(JSON.stringify({ error: 'AI mermaid request failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
