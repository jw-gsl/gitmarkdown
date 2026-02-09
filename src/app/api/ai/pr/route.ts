import { NextRequest } from 'next/server';
import { generateText } from 'ai';
import { getAIModel } from '@/lib/ai/providers';
import { checkRateLimit } from '@/lib/auth/rate-limit';

export async function POST(request: NextRequest) {
  try {
    const { files, commits, field, userApiKey, provider } = await request.json();

    // Rate limit: 15 requests/min
    const ip = request.headers.get('x-forwarded-for') || 'anonymous';
    const rateLimitResponse = checkRateLimit(`ai-pr:${ip}`, { maxTokens: 15, refillRate: 15 / 60 });
    if (rateLimitResponse) return rateLimitResponse;

    // Use cheapest available model
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
      return Response.json({ [field]: '' });
    }

    const fileSummary = (files ?? [])
      .slice(0, 20)
      .map((f: { filename: string; status: string; additions: number; deletions: number }) =>
        `${f.status}: ${f.filename} (+${f.additions} -${f.deletions})`
      )
      .join('\n');

    const commitMessages = (commits ?? [])
      .slice(0, 20)
      .map((c: { message: string }) => c.message)
      .join('\n');

    if (field === 'title') {
      const result = await generateText({
        model,
        prompt: `Generate a concise pull request title (max 72 chars) for these changes. Return ONLY the title, nothing else.\n\nFiles changed:\n${fileSummary}\n\nCommit messages:\n${commitMessages}`,
      });
      return Response.json({ title: result.text.trim().replace(/^["']|["']$/g, '') });
    }

    if (field === 'description') {
      const patches = (files ?? [])
        .slice(0, 10)
        .map((f: { filename: string; patch?: string }) => {
          if (!f.patch) return '';
          const lines = f.patch.split('\n').slice(0, 200);
          return `### ${f.filename}\n\`\`\`diff\n${lines.join('\n')}\n\`\`\``;
        })
        .filter(Boolean)
        .join('\n\n');

      const result = await generateText({
        model,
        prompt: `Generate a pull request description in markdown for these changes. Include a brief summary, key changes as bullet points, and any notable details. Be concise.\n\nFiles changed:\n${fileSummary}\n\nCommit messages:\n${commitMessages}\n\nDiff excerpts:\n${patches}`,
      });
      return Response.json({ description: result.text.trim() });
    }

    return Response.json({ error: 'Invalid field' }, { status: 400 });
  } catch {
    return Response.json({ title: '', description: '' });
  }
}
