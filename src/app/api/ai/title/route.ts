import { NextRequest } from 'next/server';
import { generateText } from 'ai';
import { getAIModel } from '@/lib/ai/providers';
import { checkRateLimit } from '@/lib/auth/rate-limit';

export async function POST(request: NextRequest) {
  try {
    const { message, userApiKey, provider } = await request.json();

    // Rate limit: 30 requests/min
    const ip = request.headers.get('x-forwarded-for') || 'anonymous';
    const rateLimitResponse = checkRateLimit(`ai-title:${ip}`, { maxTokens: 30, refillRate: 30 / 60 });
    if (rateLimitResponse) return rateLimitResponse;

    // Use cheapest available model for title generation
    let model;
    if (userApiKey && provider === 'openai') {
      model = getAIModel('openai', 'gpt-4o-mini', userApiKey);
    } else if (userApiKey && provider === 'anthropic') {
      model = getAIModel('anthropic', 'claude-haiku-4-5-20251001', userApiKey);
    } else if (process.env.OPENAI_API_KEY) {
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
