import { NextRequest } from 'next/server';
import { streamText } from 'ai';
import { getAIModel, getDefaultModel } from '@/lib/ai/providers';
import type { AIProvider } from '@/types';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const { instruction, selectedText, context, provider, modelId } = await request.json();

    const resolvedProvider = (provider || getDefaultModel().provider) as AIProvider;
    const resolvedModel = modelId || getDefaultModel().modelId;

    const result = streamText({
      model: getAIModel(resolvedProvider, resolvedModel),
      system: `You are an inline text editor. The user has selected some text and wants you to modify it based on their instruction.

Rules:
- Return ONLY the edited text, no explanations
- Preserve the original formatting style (markdown)
- If the instruction is unclear, make your best interpretation
- Keep the same general length unless asked to expand or shorten`,
      messages: [
        {
          role: 'user',
          content: `Context around the selection:
---
${context}
---

Selected text to edit:
---
${selectedText}
---

Instruction: ${instruction}

Return only the edited replacement text:`,
        },
      ],
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error('AI edit error:', error);
    return new Response(JSON.stringify({ error: 'AI edit request failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
