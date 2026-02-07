import { NextRequest } from 'next/server';
import { generateText } from 'ai';
import { getAIModel } from '@/lib/ai/providers';

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();

    // Use cheapest available model for title generation
    let model;
    if (process.env.OPENAI_API_KEY) {
      model = getAIModel('openai', 'gpt-4o-mini');
    } else if (process.env.ANTHROPIC_API_KEY) {
      model = getAIModel('anthropic', 'claude-haiku-4-5-20251001');
    } else {
      return Response.json({ title: 'New Chat' });
    }

    const result = await generateText({
      model,
      prompt: `Generate a very short title (3-6 words) for a chat that starts with this message. Return ONLY the title, nothing else.\n\nMessage: "${message}"`,
    });

    const title = result.text.trim().replace(/^["']|["']$/g, '') || 'New Chat';
    return Response.json({ title });
  } catch {
    return Response.json({ title: 'New Chat' });
  }
}
