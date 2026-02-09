import { NextRequest } from 'next/server';
import { streamText } from 'ai';
import { getAIModel, getDefaultModel, hasApiKey } from '@/lib/ai/providers';
import { checkRateLimit } from '@/lib/auth/rate-limit';
import type { AIProvider } from '@/types';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const { content, diagramType, provider, modelId, userApiKey } = await request.json();

    const resolvedProvider = (provider || getDefaultModel().provider) as AIProvider;
    const resolvedModel = modelId || getDefaultModel().modelId;

    if (!hasApiKey(resolvedProvider, userApiKey)) {
      return new Response(
        JSON.stringify({ error: 'NO_API_KEY', message: `No ${resolvedProvider === 'anthropic' ? 'Anthropic' : 'OpenAI'} API key configured. Add your key in Settings → AI.` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Rate limit: 20 requests/min
    const ip = request.headers.get('x-forwarded-for') || 'anonymous';
    const rateLimitResponse = checkRateLimit(`ai-mermaid:${ip}`, { maxTokens: 20, refillRate: 20 / 60 });
    if (rateLimitResponse) return rateLimitResponse;

    const result = streamText({
      model: getAIModel(resolvedProvider, resolvedModel, userApiKey),
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
