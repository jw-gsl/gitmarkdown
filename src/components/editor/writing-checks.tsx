'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { X, Check, Loader2, SpellCheck, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useSettingsStore } from '@/stores/settings-store';
import { useUIStore } from '@/stores/ui-store';
import { PierreContentDiffView } from '@/components/diff/pierre-diff';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface WritingIssue {
  check: string;
  text: string;
  suggestion: string;
  explanation: string;
  severity: 'error' | 'warning' | 'info';
}

interface CheckType {
  id: string;
  label: string;
  description: string;
}

const CHECK_TYPES: CheckType[] = [
  { id: 'grammar', label: 'Grammar', description: 'Fix spelling and grammar errors' },
  { id: 'brevity', label: 'Brevity', description: 'Omit needless words' },
  { id: 'cliches', label: 'Cliches', description: 'Replace over-used phrases' },
  { id: 'readability', label: 'Readability', description: 'Simplify convoluted sentences' },
  { id: 'passive-voice', label: 'Passive Voice', description: 'Convert passive voice to active voice' },
  { id: 'confidence', label: 'Confidence', description: 'Remove excessive hedging (I think, probably, etc)' },
  { id: 'repetition', label: 'Repetition', description: 'Remove repeated words' },
];

const CODE_CHECK_TYPES: CheckType[] = [
  { id: 'bugs', label: 'Bugs', description: 'Find potential bugs and logic errors' },
  { id: 'security', label: 'Security', description: 'Find security vulnerabilities' },
  { id: 'performance', label: 'Performance', description: 'Find performance issues' },
  { id: 'best-practices', label: 'Best Practices', description: 'Find anti-patterns and improvements' },
  { id: 'complexity', label: 'Complexity', description: 'Find overly complex code' },
  { id: 'error-handling', label: 'Error Handling', description: 'Find missing error handling' },
];

/** Strip HTML tags so the AI doesn't see Tiptap markup like <mark> */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

interface WritingChecksProps {
  isOpen: boolean;
  onClose: () => void;
  content: string;
  onApplyFix: (oldText: string, newText: string) => void;
  mode?: 'writing' | 'code';
  filename?: string;
}

export function WritingChecks({ isOpen, onClose, content, onApplyFix, mode = 'writing', filename }: WritingChecksProps) {
  const aiProvider = useSettingsStore((s) => s.aiProvider);
  const aiModel = useSettingsStore((s) => s.aiModel);
  const setActiveCheck = useUIStore((s) => s.setActiveCheck);
  const checkActionResult = useUIStore((s) => s.checkActionResult);
  const setCheckActionResult = useUIStore((s) => s.setCheckActionResult);

  const isCode = mode === 'code';
  const checkTypes = isCode ? CODE_CHECK_TYPES : CHECK_TYPES;

  const [selectedChecks, setSelectedChecks] = useState<Set<string>>(
    new Set(isCode ? ['bugs', 'security', 'best-practices'] : ['grammar', 'brevity', 'readability'])
  );
  const [customEnabled, setCustomEnabled] = useState(false);
  const [customInstruction, setCustomInstruction] = useState('');
  const [issues, setIssues] = useState<WritingIssue[]>([]);
  const [dismissedIndices, setDismissedIndices] = useState<Set<number>>(new Set());
  const [acceptedIndices, setAcceptedIndices] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [hasRun, setHasRun] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [activeIssueIndex, setActiveIssueIndex] = useState<number | null>(null);

  // Fix 3: Reset state when mode changes (e.g. user switches between markdown and code files)
  useEffect(() => {
    setSelectedChecks(
      new Set(isCode ? ['bugs', 'security', 'best-practices'] : ['grammar', 'brevity', 'readability'])
    );
    setIssues([]);
    setDismissedIndices(new Set());
    setAcceptedIndices(new Set());
    setHasRun(false);
    setActiveFilter('all');
    setActiveIssueIndex(null);
    setActiveCheck(null);
  }, [mode, setActiveCheck]);

  const toggleCheck = useCallback((id: string) => {
    setSelectedChecks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const runChecks = useCallback(async () => {
    const checks = Array.from(selectedChecks);
    if (customEnabled && customInstruction.trim()) {
      checks.push('custom');
    }

    if (checks.length === 0) {
      toast.error('Select at least one check to run');
      return;
    }

    if (!content.trim()) {
      toast.error('No content to check');
      return;
    }

    setLoading(true);
    setIssues([]);
    setDismissedIndices(new Set());
    setAcceptedIndices(new Set());
    setHasRun(true);
    setActiveFilter('all');

    try {
      const res = await fetch('/api/ai/checks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: isCode ? content : stripHtml(content),
          checks,
          customInstruction: customEnabled ? customInstruction : undefined,
          provider: aiProvider,
          modelId: aiModel,
          mode,
          filename,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Check failed');
      }

      const data = await res.json();
      const rawIssues: WritingIssue[] = data.issues || [];

      // Sort issues by their position in the file (top → bottom), same as comments
      const plainContent = isCode ? content : stripHtml(content);
      rawIssues.sort((a, b) => {
        const posA = plainContent.indexOf(a.text);
        const posB = plainContent.indexOf(b.text);
        // If text not found, push to end
        return (posA === -1 ? Infinity : posA) - (posB === -1 ? Infinity : posB);
      });

      setIssues(rawIssues);
      if (data.truncated) {
        toast.warning('File was truncated for analysis. Only the first ~100K characters were reviewed.');
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to run checks';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [selectedChecks, customEnabled, customInstruction, content, aiProvider, aiModel, mode, filename, isCode]);

  const handleRerun = useCallback(() => {
    setHasRun(false);
    setIssues([]);
    setDismissedIndices(new Set());
    setAcceptedIndices(new Set());
    setActiveFilter('all');
    setActiveIssueIndex(null);
    setActiveCheck(null);
  }, [setActiveCheck]);

  const handleKeep = useCallback(
    (index: number) => {
      const issue = issues[index];
      onApplyFix(issue.text, issue.suggestion);
      setAcceptedIndices((prev) => new Set(prev).add(index));
      setActiveIssueIndex(null);
      setActiveCheck(null);
      setCheckActionResult(null);
    },
    [issues, onApplyFix, setActiveCheck, setCheckActionResult]
  );

  const handleDismiss = useCallback((index: number) => {
    setDismissedIndices((prev) => new Set(prev).add(index));
    if (activeIssueIndex === index) {
      setActiveIssueIndex(null);
      setActiveCheck(null);
    }
  }, [activeIssueIndex, setActiveCheck]);

  const handleSelectIssue = useCallback((index: number, issue: WritingIssue) => {
    if (activeIssueIndex === index) {
      setActiveIssueIndex(null);
      setActiveCheck(null);
    } else {
      setActiveIssueIndex(index);
      setActiveCheck({ text: issue.text, suggestion: issue.suggestion, index });
    }
  }, [activeIssueIndex, setActiveCheck]);

  // Sync inline editor Keep/Dismiss actions back to sidebar state
  useEffect(() => {
    if (!checkActionResult) return;
    const { index, action } = checkActionResult;
    if (action === 'keep') {
      const issue = issues[index];
      if (issue) onApplyFix(issue.text, issue.suggestion);
      setAcceptedIndices((prev) => new Set(prev).add(index));
    } else {
      setDismissedIndices((prev) => new Set(prev).add(index));
    }
    setActiveIssueIndex(null);
    setCheckActionResult(null);
  }, [checkActionResult, issues, onApplyFix, setCheckActionResult]);

  // Compute filter tabs with counts from non-resolved issues
  const filterTabs = useMemo(() => {
    const resolvedSet = new Set([...dismissedIndices, ...acceptedIndices]);
    const counts: Record<string, number> = {};
    let total = 0;
    for (let i = 0; i < issues.length; i++) {
      if (resolvedSet.has(i)) continue;
      total++;
      const key = issues[i].check;
      counts[key] = (counts[key] || 0) + 1;
    }

    const tabs: { id: string; label: string; count: number }[] = [
      { id: 'all', label: 'All', count: total },
    ];

    // Only show tabs for categories that have issues
    for (const check of checkTypes) {
      if (counts[check.id]) {
        tabs.push({ id: check.id, label: check.label, count: counts[check.id] });
      }
    }
    // Include custom if present
    if (counts['custom']) {
      tabs.push({ id: 'custom', label: 'Custom', count: counts['custom'] });
    }

    return tabs;
  }, [issues, dismissedIndices, acceptedIndices, checkTypes]);

  // Filter visible issues by active tab
  const visibleIssues = useMemo(() => {
    const resolvedSet = new Set([...dismissedIndices, ...acceptedIndices]);
    return issues
      .map((issue, index) => ({ issue, index }))
      .filter(({ index }) => !resolvedSet.has(index))
      .filter(({ issue }) => activeFilter === 'all' || issue.check === activeFilter);
  }, [issues, dismissedIndices, acceptedIndices, activeFilter]);

  const totalResolved = dismissedIndices.size + acceptedIndices.size;

  const handleClose = useCallback(() => {
    setActiveIssueIndex(null);
    setActiveCheck(null);
    onClose();
  }, [onClose, setActiveCheck]);

  if (!isOpen) return null;

  return (
    <div className="flex h-full w-full flex-col bg-background" data-testid="writing-checks-panel">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <SpellCheck className="h-4 w-4" />
          <h2 className="text-sm font-semibold">{isCode ? 'Code Review' : 'Writing Checks'}</h2>
        </div>
        <div className="flex items-center gap-1">
          {hasRun && !loading && (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={handleRerun}
              aria-label="Re-run checks"
              className="h-7 w-7"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center gap-3 py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{isCode ? 'Reviewing your code...' : 'Analyzing your writing...'}</p>
        </div>
      )}

      {/* Check selection (before running) */}
      {!hasRun && !loading && (
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-3">
                Choose checks to run
              </p>
              <div className="space-y-1">
                {checkTypes.map((check) => (
                  <label
                    key={check.id}
                    className={cn(
                      'flex items-start gap-3 rounded-md px-3 py-2 text-sm cursor-pointer transition-colors',
                      selectedChecks.has(check.id)
                        ? 'bg-accent/50'
                        : 'hover:bg-accent/30'
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={selectedChecks.has(check.id)}
                      onChange={() => toggleCheck(check.id)}
                      className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
                      data-testid={`check-${check.id}`}
                    />
                    <div className="min-w-0">
                      <div className="font-medium text-sm">{check.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {check.description}
                      </div>
                    </div>
                  </label>
                ))}

                {/* Custom check */}
                <label
                  className={cn(
                    'flex items-start gap-3 rounded-md px-3 py-2 text-sm cursor-pointer transition-colors',
                    customEnabled ? 'bg-accent/50' : 'hover:bg-accent/30'
                  )}
                >
                  <input
                    type="checkbox"
                    checked={customEnabled}
                    onChange={() => setCustomEnabled(!customEnabled)}
                    className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
                    data-testid="check-custom"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm">Custom</div>
                    {customEnabled && (
                      <Input
                        value={customInstruction}
                        onChange={(e) => setCustomInstruction(e.target.value)}
                        placeholder="What should we check for?"
                        className="mt-1.5 h-8 text-xs"
                        data-testid="custom-check-input"
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}
                  </div>
                </label>
              </div>
            </div>

            <Button
              onClick={runChecks}
              disabled={selectedChecks.size === 0 && !customEnabled}
              className="w-full"
              data-testid="run-checks"
            >
              Run checks
            </Button>

            <p className="text-[10px] text-muted-foreground text-center">
              {isCode ? 'AI-powered code review. Results may vary.' : 'AI-powered writing analysis. Results may vary.'}
            </p>
          </div>
        </ScrollArea>
      )}

      {/* Results view (after running) */}
      {hasRun && !loading && (
        <>
          {/* Category filter tabs */}
          {filterTabs.length > 1 && visibleIssues.length > 0 && (
            <div className="flex items-center gap-1 px-3 py-2 border-b overflow-x-auto scrollbar-none">
              {filterTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveFilter(tab.id)}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium whitespace-nowrap transition-colors',
                    activeFilter === tab.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/60 text-muted-foreground hover:bg-muted'
                  )}
                >
                  {tab.label}
                  <span className={cn(
                    'text-[10px] tabular-nums',
                    activeFilter === tab.id ? 'text-primary-foreground/70' : 'text-muted-foreground/70'
                  )}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>
          )}

          <ScrollArea className="flex-1">
            <div className="p-4 space-y-3">
              {visibleIssues.length === 0 ? (
                <div className="text-center py-8">
                  <Check className="h-8 w-8 mx-auto text-green-500 mb-2" />
                  <p className="text-sm font-medium">
                    {issues.length === 0 ? 'No issues found' : 'All issues addressed'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {issues.length === 0
                      ? (isCode ? 'Your code looks great!' : 'Your writing looks great!')
                      : `${totalResolved} issue${totalResolved !== 1 ? 's' : ''} resolved`}
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">
                    {visibleIssues.length} issue{visibleIssues.length !== 1 ? 's' : ''}
                    {totalResolved > 0 && ` (${totalResolved} resolved)`}
                  </p>

                  {visibleIssues.map(({ issue, index }) => (
                    <IssueCard
                      key={index}
                      issue={issue}
                      isActive={activeIssueIndex === index}
                      onSelect={() => handleSelectIssue(index, issue)}
                      onKeep={() => handleKeep(index)}
                      onDismiss={() => handleDismiss(index)}
                    />
                  ))}
                </>
              )}

              <p className="text-[10px] text-muted-foreground text-center pt-2">
                AI can make mistakes. Verify important changes.
              </p>
            </div>
          </ScrollArea>
        </>
      )}
    </div>
  );
}

function IssueCard({
  issue,
  isActive,
  onSelect,
  onKeep,
  onDismiss,
}: {
  issue: WritingIssue;
  isActive: boolean;
  onSelect: () => void;
  onKeep: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      className={cn(
        'rounded-md border p-3 text-xs space-y-2 cursor-pointer transition-colors',
        isActive ? 'border-orange-400 bg-orange-50 dark:bg-orange-950/30 dark:border-orange-600' : 'hover:bg-muted/30'
      )}
      data-testid="issue-card"
      onClick={onSelect}
    >
      <div className="min-w-0 space-y-1.5">
        <Badge variant="outline" className="text-[10px] capitalize h-4 px-1.5">
          {issue.check}
        </Badge>
        {/* Original → Suggestion diff */}
        <div className="rounded border overflow-hidden">
          <PierreContentDiffView
            oldContent={issue.text}
            newContent={issue.suggestion}
            viewMode="unified"
          />
        </div>
        <p className="text-muted-foreground leading-relaxed">{issue.explanation}</p>
      </div>

      <div className="flex justify-end gap-1.5">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-[11px] px-2"
          onClick={(e) => { e.stopPropagation(); onDismiss(); }}
          data-testid="dismiss-issue"
        >
          <X className="h-3 w-3 mr-1" />
          Dismiss
        </Button>
        <Button
          size="sm"
          className="h-6 text-[11px] px-2"
          onClick={(e) => { e.stopPropagation(); onKeep(); }}
          data-testid="keep-issue"
        >
          <Check className="h-3 w-3 mr-1" />
          Keep
        </Button>
      </div>
    </div>
  );
}
