import { NextRequest } from 'next/server';
import { generateText } from 'ai';
import { getAIModel } from '@/lib/ai/providers';
import { checkRateLimit } from '@/lib/auth/rate-limit';
import type { AIProvider } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const { changedFiles, provider, modelId, userApiKey } = await request.json();

    // Rate limit: 20 requests/min
    const ip = request.headers.get('x-forwarded-for') || 'anonymous';
    const rateLimitResponse = checkRateLimit(`ai-commit:${ip}`, { maxTokens: 20, refillRate: 20 / 60 });
    if (rateLimitResponse) return rateLimitResponse;

    // Pick a model — prefer the user's chosen one, otherwise cheapest available
    let model;
    if (provider && modelId) {
      model = getAIModel(provider as AIProvider, modelId, userApiKey);
    } else if (userApiKey && provider === 'openai') {
      model = getAIModel('openai', 'gpt-4o-mini', userApiKey);
    } else if (userApiKey && provider === 'anthropic') {
      model = getAIModel('anthropic', 'claude-haiku-4-5-20251001', userApiKey);
    } else if (process.env.OPENAI_API_KEY) {
      model = getAIModel('openai', 'gpt-4o-mini');
    } else if (process.env.ANTHROPIC_API_KEY) {
      model = getAIModel('anthropic', 'claude-haiku-4-5-20251001');
    } else {
      return Response.json({ message: 'Update files', description: '' });
    }

    const result = await generateText({
      model,
      prompt: `Generate a concise git commit message for changes to these files: ${(changedFiles as string[]).join(', ')}.

Return ONLY the commit message in this exact format:
<title>short imperative title (max 72 chars)</title>
<description>1-2 sentence description of the changes</description>`,
    });

    const text = result.text;
    const titleMatch = text.match(/<title>([\s\S]*?)<\/title>/);
    const descMatch = text.match(/<description>([\s\S]*?)<\/description>/);

    return Response.json({
      message: titleMatch?.[1]?.trim() || text.split('\n')[0]?.trim() || 'Update files',
      description: descMatch?.[1]?.trim() || '',
    });
  } catch (error) {
    console.error('AI commit message error:', error);
    return Response.json({ message: '', description: '' }, { status: 500 });
  }
}
