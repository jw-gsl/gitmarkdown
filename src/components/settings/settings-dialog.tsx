'use client';

import { useState, useCallback } from 'react';
import { Settings, Type, Bot, Timer, Monitor, Sun, Moon, Minus, Plus } from 'lucide-react';
import { useTheme } from 'next-themes';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useSettingsStore } from '@/stores/settings-store';
import { cn } from '@/lib/utils';
import type { AIProvider } from '@/types';

const AI_MODELS: Record<AIProvider, { value: string; label: string }[]> = {
  anthropic: [
    { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
    { value: 'claude-opus-4-20250514', label: 'Claude Opus 4' },
    { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
  ],
  openai: [
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { value: 'o1', label: 'o1' },
  ],
};

type Tab = 'general' | 'editor' | 'ai' | 'auto-save';

const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'editor', label: 'Editor', icon: Type },
  { id: 'ai', label: 'AI', icon: Bot },
  { id: 'auto-save', label: 'Auto-Save', icon: Timer },
];

function NumberStepper({
  value,
  onChange,
  min,
  max,
  step,
  format,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  format?: (v: number) => string;
}) {
  const display = format ? format(value) : String(value);
  const canDecrement = value - step >= min - 0.001;
  const canIncrement = value + step <= max + 0.001;

  const decrement = () => {
    if (canDecrement) {
      const next = Math.round((value - step) * 100) / 100;
      onChange(Math.max(min, next));
    }
  };

  const increment = () => {
    if (canIncrement) {
      const next = Math.round((value + step) * 100) / 100;
      onChange(Math.min(max, next));
    }
  };

  return (
    <div className="inline-flex items-center rounded-md border">
      <Button
        variant="ghost"
        size="icon-xs"
        className="h-8 w-8 rounded-r-none border-r"
        onClick={decrement}
        disabled={!canDecrement}
      >
        <Minus className="size-3" />
      </Button>
      <span className="min-w-[3.5rem] text-center text-sm font-medium tabular-nums">
        {display}
      </span>
      <Button
        variant="ghost"
        size="icon-xs"
        className="h-8 w-8 rounded-l-none border-l"
        onClick={increment}
        disabled={!canIncrement}
      >
        <Plus className="size-3" />
      </Button>
    </div>
  );
}

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [activeTab, setActiveTab] = useState<Tab>('general');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] h-[85vh] sm:max-w-2xl sm:h-[min(600px,85vh)] p-0 gap-0 overflow-hidden flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-0 shrink-0">
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription className="sr-only">
            Configure your GitMarkdown preferences
          </DialogDescription>
        </DialogHeader>
        <Separator className="mt-4 shrink-0" />
        <div className="flex flex-col sm:flex-row min-h-0 flex-1">
          {/* Tab navigation */}
          <nav className="flex sm:flex-col sm:w-44 shrink-0 overflow-x-auto sm:overflow-x-visible gap-1 sm:gap-0.5 p-2 sm:border-r border-b sm:border-b-0">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap',
                    'sm:w-full',
                    activeTab === tab.id
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {tab.label}
                </button>
              );
            })}
          </nav>

          {/* Content area */}
          <div className="flex-1 p-6 overflow-y-auto min-h-0">
            {activeTab === 'general' && <GeneralSettings />}
            {activeTab === 'editor' && <EditorSettings />}
            {activeTab === 'ai' && <AISettings />}
            {activeTab === 'auto-save' && <AutoSaveSettings />}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function GeneralSettings() {
  const { setTheme } = useTheme();
  const storeTheme = useSettingsStore((s) => s.theme);
  const setStoreTheme = useSettingsStore((s) => s.setTheme);
  const pullOnOpen = useSettingsStore((s) => s.pullOnOpen);
  const setPullOnOpen = useSettingsStore((s) => s.setPullOnOpen);

  const handleThemeChange = (value: 'light' | 'dark' | 'system') => {
    setStoreTheme(value);
    setTheme(value);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium mb-1">Theme</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Choose your preferred appearance
        </p>
        <div className="grid grid-cols-3 gap-2">
          {[
            { value: 'light' as const, label: 'Light', icon: Sun },
            { value: 'dark' as const, label: 'Dark', icon: Moon },
            { value: 'system' as const, label: 'System', icon: Monitor },
          ].map((option) => {
            const Icon = option.icon;
            return (
              <button
                key={option.value}
                onClick={() => handleThemeChange(option.value)}
                className={cn(
                  'flex flex-col items-center gap-1.5 rounded-md border p-3 text-sm transition-colors',
                  storeTheme === option.value
                    ? 'border-primary bg-accent text-accent-foreground'
                    : 'border-border hover:bg-accent/50'
                )}
              >
                <Icon className="h-5 w-5" />
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <Separator />

      {/* Pull on open */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="pull-on-open">Pull on open</Label>
          <p className="text-xs text-muted-foreground">
            Automatically pull the latest changes when you open a file
          </p>
        </div>
        <Switch
          id="pull-on-open"
          checked={pullOnOpen}
          onCheckedChange={setPullOnOpen}
        />
      </div>
    </div>
  );
}

function EditorSettings() {
  const editorFontSize = useSettingsStore((s) => s.editorFontSize);
  const setEditorFontSize = useSettingsStore((s) => s.setEditorFontSize);
  const editorLineHeight = useSettingsStore((s) => s.editorLineHeight);
  const setEditorLineHeight = useSettingsStore((s) => s.setEditorLineHeight);
  const showLineNumbers = useSettingsStore((s) => s.showLineNumbers);
  const setShowLineNumbers = useSettingsStore((s) => s.setShowLineNumbers);

  return (
    <div className="space-y-6">
      {/* Font Size */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label>Font size</Label>
          <p className="text-xs text-muted-foreground">
            Adjust the editor font size (12px - 24px)
          </p>
        </div>
        <NumberStepper
          value={editorFontSize}
          onChange={setEditorFontSize}
          min={12}
          max={24}
          step={1}
          format={(v) => `${v}px`}
        />
      </div>

      <Separator />

      {/* Line Height */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label>Line height</Label>
          <p className="text-xs text-muted-foreground">
            Adjust the spacing between lines (1.0 - 2.5)
          </p>
        </div>
        <NumberStepper
          value={editorLineHeight}
          onChange={setEditorLineHeight}
          min={1.0}
          max={2.5}
          step={0.1}
          format={(v) => v.toFixed(1)}
        />
      </div>

      <Separator />

      {/* Show Line Numbers */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="line-numbers">Show line numbers</Label>
          <p className="text-xs text-muted-foreground">
            Display line numbers in the editor gutter
          </p>
        </div>
        <Switch
          id="line-numbers"
          checked={showLineNumbers}
          onCheckedChange={setShowLineNumbers}
        />
      </div>
    </div>
  );
}

function AISettings() {
  const aiProvider = useSettingsStore((s) => s.aiProvider);
  const setAIProvider = useSettingsStore((s) => s.setAIProvider);
  const aiModel = useSettingsStore((s) => s.aiModel);
  const setAIModel = useSettingsStore((s) => s.setAIModel);

  const availableModels = AI_MODELS[aiProvider] || [];

  const handleProviderChange = (value: string) => {
    const provider = value as AIProvider;
    setAIProvider(provider);
    const models = AI_MODELS[provider];
    if (models && models.length > 0) {
      setAIModel(models[0].value);
    }
  };

  return (
    <div className="space-y-6">
      {/* AI Provider */}
      <div className="space-y-2">
        <Label>Default AI provider</Label>
        <Select value={aiProvider} onValueChange={handleProviderChange}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select provider" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="anthropic">Anthropic</SelectItem>
            <SelectItem value="openai">OpenAI</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Choose the default AI provider for suggestions and completions
        </p>
      </div>

      <Separator />

      {/* AI Model */}
      <div className="space-y-2">
        <Label>Default AI model</Label>
        <Select value={aiModel} onValueChange={setAIModel}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select model" />
          </SelectTrigger>
          <SelectContent>
            {availableModels.map((model) => (
              <SelectItem key={model.value} value={model.value}>
                {model.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Choose the default model for the selected provider
        </p>
      </div>
    </div>
  );
}

function AutoSaveSettings() {
  const autoCommitDelay = useSettingsStore((s) => s.autoCommitDelay);
  const setAutoCommitDelay = useSettingsStore((s) => s.setAutoCommitDelay);
  const saveStrategy = useSettingsStore((s) => s.saveStrategy);
  const setSaveStrategy = useSettingsStore((s) => s.setSaveStrategy);
  const autoBranchPrefix = useSettingsStore((s) => s.autoBranchPrefix);
  const setAutoBranchPrefix = useSettingsStore((s) => s.setAutoBranchPrefix);
  const commitOnClose = useSettingsStore((s) => s.commitOnClose);
  const setCommitOnClose = useSettingsStore((s) => s.setCommitOnClose);
  const filePattern = useSettingsStore((s) => s.filePattern);
  const setFilePattern = useSettingsStore((s) => s.setFilePattern);
  const commitValidationLevel = useSettingsStore((s) => s.commitValidationLevel);
  const setCommitValidationLevel = useSettingsStore((s) => s.setCommitValidationLevel);
  const excludeBranches = useSettingsStore((s) => s.excludeBranches);
  const setExcludeBranches = useSettingsStore((s) => s.setExcludeBranches);
  const aiCommitMessages = useSettingsStore((s) => s.aiCommitMessages);
  const setAiCommitMessages = useSettingsStore((s) => s.setAiCommitMessages);
  const autoCreatePR = useSettingsStore((s) => s.autoCreatePR);
  const setAutoCreatePR = useSettingsStore((s) => s.setAutoCreatePR);
  const autoCreatePRTitle = useSettingsStore((s) => s.autoCreatePRTitle);
  const setAutoCreatePRTitle = useSettingsStore((s) => s.setAutoCreatePRTitle);

  const isAutoCommitEnabled = autoCommitDelay > 0;

  const handleToggleAutoCommit = (enabled: boolean) => {
    if (enabled) {
      setAutoCommitDelay(30);
    } else {
      setAutoCommitDelay(0);
    }
  };

  const handleDelayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val) && val >= 1) {
      setAutoCommitDelay(val);
    }
  };

  // Use local string state so the user can type commas freely;
  // only parse to array on blur
  const [excludeBranchesInput, setExcludeBranchesInput] = useState(
    excludeBranches.join(', ')
  );

  const handleExcludeBranchesBlur = useCallback(() => {
    const branches = excludeBranchesInput
      .split(',')
      .map((b) => b.trim())
      .filter(Boolean);
    setExcludeBranches(branches);
  }, [excludeBranchesInput, setExcludeBranches]);

  return (
    <div className="space-y-6">
      {/* Enable Auto-Commit */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="auto-commit">Enable auto-commit</Label>
          <p className="text-xs text-muted-foreground">
            Automatically commit changes after a period of inactivity
          </p>
        </div>
        <Switch
          id="auto-commit"
          checked={isAutoCommitEnabled}
          onCheckedChange={handleToggleAutoCommit}
        />
      </div>

      <Separator />

      {/* Auto-Commit Delay */}
      <div className="space-y-2">
        <Label htmlFor="commit-delay">Auto-commit delay (seconds)</Label>
        <Input
          id="commit-delay"
          type="number"
          min={1}
          max={300}
          value={isAutoCommitEnabled ? autoCommitDelay : ''}
          onChange={handleDelayChange}
          disabled={!isAutoCommitEnabled}
          className="w-24"
        />
        <p className="text-xs text-muted-foreground">
          Time to wait after last edit before auto-committing (1-300 seconds)
        </p>
      </div>

      <Separator />

      {/* Save Strategy */}
      <div className="space-y-3">
        <Label>Save strategy</Label>
        <div className="space-y-2">
          <button
            onClick={() => setSaveStrategy('main')}
            className={cn(
              'flex w-full items-start gap-3 rounded-md border p-3 text-left text-sm transition-colors',
              saveStrategy === 'main'
                ? 'border-primary bg-accent'
                : 'border-border hover:bg-accent/50'
            )}
          >
            <div className={cn(
              'mt-0.5 h-4 w-4 shrink-0 rounded-full border-2',
              saveStrategy === 'main' ? 'border-primary bg-primary' : 'border-muted-foreground'
            )} />
            <div>
              <p className="font-medium">Save to current branch</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Commits are saved directly to the branch you&apos;re working on
              </p>
            </div>
          </button>
          <button
            onClick={() => setSaveStrategy('branch')}
            className={cn(
              'flex w-full items-start gap-3 rounded-md border p-3 text-left text-sm transition-colors',
              saveStrategy === 'branch'
                ? 'border-primary bg-accent'
                : 'border-border hover:bg-accent/50'
            )}
          >
            <div className={cn(
              'mt-0.5 h-4 w-4 shrink-0 rounded-full border-2',
              saveStrategy === 'branch' ? 'border-primary bg-primary' : 'border-muted-foreground'
            )} />
            <div>
              <p className="font-medium">Save to auto-created branch</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Creates a new branch for each editing session
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* Branch options (only shown when branch strategy selected) */}
      {saveStrategy === 'branch' && (
        <>
          <div className="space-y-2">
            <Label htmlFor="branch-prefix">Branch name prefix</Label>
            <Input
              id="branch-prefix"
              value={autoBranchPrefix}
              onChange={(e) => setAutoBranchPrefix(e.target.value)}
              placeholder="gitmarkdown-auto/"
              className="w-56"
            />
            <p className="text-xs text-muted-foreground">
              Branches will be named like <code className="rounded bg-muted px-1 py-0.5 text-[11px]">{autoBranchPrefix}2024-01-15-1430</code>
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="auto-create-pr">Auto-create pull request</Label>
              <p className="text-xs text-muted-foreground">
                Automatically open a PR after the first commit to the auto-created branch
              </p>
            </div>
            <Switch
              id="auto-create-pr"
              checked={autoCreatePR}
              onCheckedChange={setAutoCreatePR}
            />
          </div>

          {autoCreatePR && (
            <div className="space-y-2">
              <Label htmlFor="pr-title">PR title template</Label>
              <Input
                id="pr-title"
                value={autoCreatePRTitle}
                onChange={(e) => setAutoCreatePRTitle(e.target.value)}
                placeholder="Auto-save changes from GitMarkdown"
              />
              <p className="text-xs text-muted-foreground">
                Title for the automatically created pull request
              </p>
            </div>
          )}
        </>
      )}

      <Separator />

      {/* Commit on close */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="commit-on-close">Commit on close</Label>
          <p className="text-xs text-muted-foreground">
            Automatically save unsaved changes when you leave the page
          </p>
        </div>
        <Switch
          id="commit-on-close"
          checked={commitOnClose}
          onCheckedChange={setCommitOnClose}
        />
      </div>

      <Separator />

      {/* File pattern */}
      <div className="space-y-2">
        <Label htmlFor="file-pattern">File pattern</Label>
        <Input
          id="file-pattern"
          value={filePattern}
          onChange={(e) => setFilePattern(e.target.value)}
          placeholder="**/*.md"
          className="w-56"
        />
        <p className="text-xs text-muted-foreground">
          Glob pattern for files to auto-commit (e.g. **/*.md)
        </p>
      </div>

      <Separator />

      {/* Commit validation level */}
      <div className="space-y-2">
        <Label>Commit validation level</Label>
        <Select
          value={commitValidationLevel}
          onValueChange={(v) => setCommitValidationLevel(v as 'none' | 'warning' | 'error')}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
            <SelectItem value="error">Error</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Only auto-commit when the file has no problems at or above this level
        </p>
      </div>

      <Separator />

      {/* Exclude branches */}
      <div className="space-y-2">
        <Label htmlFor="exclude-branches">Exclude branches</Label>
        <Input
          id="exclude-branches"
          value={excludeBranchesInput}
          onChange={(e) => setExcludeBranchesInput(e.target.value)}
          onBlur={handleExcludeBranchesBlur}
          placeholder="main, production"
        />
        <p className="text-xs text-muted-foreground">
          Branches where auto-commit is disabled (comma-separated)
        </p>
      </div>

      <Separator />

      {/* AI commit messages */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="ai-commit-messages">AI commit messages</Label>
          <p className="text-xs text-muted-foreground">
            Use AI to generate descriptive commit messages instead of timestamps
          </p>
        </div>
        <Switch
          id="ai-commit-messages"
          checked={aiCommitMessages}
          onCheckedChange={setAiCommitMessages}
        />
      </div>
    </div>
  );
}
