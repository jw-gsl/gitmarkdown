import { NextRequest } from 'next/server';
import { generateText } from 'ai';
import { getAIModel } from '@/lib/ai/providers';
import type { AIProvider } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const { changedFiles, provider, modelId } = await request.json();

    // Pick a model — prefer the user's chosen one, otherwise cheapest available
    let model;
    if (provider && modelId) {
      model = getAIModel(provider as AIProvider, modelId);
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
