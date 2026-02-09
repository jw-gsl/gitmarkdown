'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSettingsStore } from '@/stores/settings-store';
import { aiModels } from '@/lib/ai/providers';

export function AIProviderSelect() {
  const { aiModel, setAIModel, setAIProvider } = useSettingsStore();

  const handleChange = (modelId: string) => {
    const model = aiModels.find((m) => m.id === modelId);
    if (model) {
      setAIModel(model.id);
      setAIProvider(model.provider);
    }
  };

  return (
    <Select value={aiModel} onValueChange={handleChange}>
      <SelectTrigger data-testid="ai-model-select" aria-label="Select AI model" className="h-8 text-xs">
        <SelectValue placeholder="Select model" />
      </SelectTrigger>
      <SelectContent>
        {aiModels.map((model) => (
          <SelectItem key={model.id} value={model.id} className="text-xs">
            {model.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
