import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import type { AIProvider, AIModel } from '@/types';

export const aiModels: AIModel[] = [
  { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', provider: 'anthropic' },
  { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', provider: 'anthropic' },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai' },
];

export function getAIModel(provider: AIProvider, modelId: string) {
  switch (provider) {
    case 'anthropic':
      return createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })(modelId);
    case 'openai':
      return createOpenAI({ apiKey: process.env.OPENAI_API_KEY })(modelId);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

export function getDefaultModel() {
  const provider = (process.env.NEXT_PUBLIC_DEFAULT_AI_PROVIDER || 'anthropic') as AIProvider;
  const modelId = process.env.NEXT_PUBLIC_DEFAULT_AI_MODEL || 'claude-sonnet-4-20250514';
  return { provider, modelId };
}
