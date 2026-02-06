'use client';

import { useState } from 'react';
import { useCompletion } from '@ai-sdk/react';
import { Loader2, Copy, Check, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useSettingsStore } from '@/stores/settings-store';

const diagramTypes = [
  { value: 'flowchart', label: 'Flowchart' },
  { value: 'sequence', label: 'Sequence Diagram' },
  { value: 'classDiagram', label: 'Class Diagram' },
  { value: 'stateDiagram', label: 'State Diagram' },
  { value: 'erDiagram', label: 'ER Diagram' },
  { value: 'gantt', label: 'Gantt Chart' },
  { value: 'mindmap', label: 'Mind Map' },
];

interface MermaidGeneratorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsert: (mermaidCode: string) => void;
  context?: string;
}

export function MermaidGenerator({ open, onOpenChange, onInsert, context }: MermaidGeneratorProps) {
  const [diagramType, setDiagramType] = useState('flowchart');
  const [description, setDescription] = useState('');
  const [copied, setCopied] = useState(false);
  const { aiProvider, aiModel } = useSettingsStore();

  const { completion, complete, isLoading } = useCompletion({
    api: '/api/ai/mermaid',
    body: {
      diagramType,
      provider: aiProvider,
      modelId: aiModel,
    },
  });

  const handleGenerate = async () => {
    const input = description || context || '';
    if (!input.trim()) return;
    await complete(input);
  };

  const handleCopy = () => {
    if (completion) {
      navigator.clipboard.writeText(`\`\`\`mermaid\n${completion}\n\`\`\``);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleInsert = () => {
    if (completion) {
      onInsert(`\`\`\`mermaid\n${completion}\n\`\`\``);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Generate Mermaid Diagram
          </DialogTitle>
          <DialogDescription>
            Describe what you want to visualize and AI will generate a Mermaid diagram.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Diagram Type</Label>
            <Select value={diagramType} onValueChange={setDiagramType}>
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {diagramTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the diagram you want to generate..."
              className="mt-1.5"
              rows={3}
            />
          </div>

          <Button onClick={handleGenerate} disabled={isLoading || (!description.trim() && !context)}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate Diagram
              </>
            )}
          </Button>

          {completion && (
            <div className="space-y-3">
              <div className="rounded border">
                <div className="flex items-center justify-between border-b bg-muted/50 px-3 py-2">
                  <span className="text-xs font-medium">Mermaid Code</span>
                  <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={handleCopy}>
                    {copied ? <Check className="mr-1 h-3 w-3" /> : <Copy className="mr-1 h-3 w-3" />}
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                </div>
                <pre className="overflow-auto p-3 text-xs">{completion}</pre>
              </div>
              <Button onClick={handleInsert} className="w-full">
                Insert into Editor
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
