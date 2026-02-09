'use client';

import { useState } from 'react';
import { ChevronsUpDown, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { useSettingsStore } from '@/stores/settings-store';
import { aiModels } from '@/lib/ai/providers';

export function AIProviderSelect() {
  const { aiModel, setAIModel, setAIProvider } = useSettingsStore();
  const [open, setOpen] = useState(false);

  const selectedModel = aiModels.find((m) => m.id === aiModel);

  const handleSelect = (modelId: string) => {
    const model = aiModels.find((m) => m.id === modelId);
    if (model) {
      setAIModel(model.id);
      setAIProvider(model.provider);
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          data-testid="ai-model-select"
          aria-label="Select AI model"
          className="h-8 text-xs justify-between w-full font-normal"
        >
          <span className="truncate">{selectedModel?.name || 'Select model'}</span>
          <ChevronsUpDown className="ml-1.5 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search models..." className="h-8 text-xs" />
          <CommandList>
            <CommandEmpty className="text-xs py-3">No model found.</CommandEmpty>
            <CommandGroup heading="Anthropic">
              {aiModels
                .filter((m) => m.provider === 'anthropic')
                .map((model) => (
                  <CommandItem
                    key={model.id}
                    value={model.name}
                    onSelect={() => handleSelect(model.id)}
                    className="text-xs"
                  >
                    {model.name}
                    {model.id === aiModel && (
                      <Check className="ml-auto h-3 w-3 text-primary" />
                    )}
                  </CommandItem>
                ))}
            </CommandGroup>
            <CommandGroup heading="OpenAI">
              {aiModels
                .filter((m) => m.provider === 'openai')
                .map((model) => (
                  <CommandItem
                    key={model.id}
                    value={model.name}
                    onSelect={() => handleSelect(model.id)}
                    className="text-xs"
                  >
                    {model.name}
                    {model.id === aiModel && (
                      <Check className="ml-auto h-3 w-3 text-primary" />
                    )}
                  </CommandItem>
                ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
