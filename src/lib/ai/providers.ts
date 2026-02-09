import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import type { AIProvider, AIModel } from '@/types';

export const aiModels: AIModel[] = [
  // Anthropic
  { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', provider: 'anthropic' },
  { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5', provider: 'anthropic' },
  { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', provider: 'anthropic' },
  { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', provider: 'anthropic' },
  // OpenAI
  { id: 'gpt-4.1', name: 'GPT-4.1', provider: 'openai' },
  { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', provider: 'openai' },
  { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano', provider: 'openai' },
  { id: 'o3', name: 'o3', provider: 'openai' },
  { id: 'o4-mini', name: 'o4-mini', provider: 'openai' },
  { id: 'o3-mini', name: 'o3-mini', provider: 'openai' },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai' },
];

export function getAIModel(provider: AIProvider, modelId: string, userApiKey?: string) {
  switch (provider) {
    case 'anthropic': {
      const apiKey = userApiKey || process.env.ANTHROPIC_API_KEY;
      if (!apiKey) throw new Error('No Anthropic API key available');
      return createAnthropic({ apiKey })(modelId);
    }
    case 'openai': {
      const apiKey = userApiKey || process.env.OPENAI_API_KEY;
      if (!apiKey) throw new Error('No OpenAI API key available');
      return createOpenAI({ apiKey })(modelId);
    }
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

/** Check if any API key is available for the given provider (user-provided or env). */
export function hasApiKey(provider: AIProvider, userApiKey?: string): boolean {
  if (userApiKey) return true;
  if (provider === 'anthropic') return !!process.env.ANTHROPIC_API_KEY;
  if (provider === 'openai') return !!process.env.OPENAI_API_KEY;
  return false;
}

export function getDefaultModel() {
  const provider = (process.env.NEXT_PUBLIC_DEFAULT_AI_PROVIDER || 'anthropic') as AIProvider;
  const modelId = process.env.NEXT_PUBLIC_DEFAULT_AI_MODEL || 'claude-sonnet-4-20250514';
  return { provider, modelId };
}
