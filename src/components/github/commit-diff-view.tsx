'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { X, ExternalLink, Loader2, FileText, Plus, Minus, FileEdit, ChevronsRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useGitHubCommits } from '@/hooks/use-github';
import { useUIStore } from '@/stores/ui-store';
import { toast } from 'sonner';
import type { GitHubCommit } from '@/types';

interface CommitFile {
  filename: string;
  status: string;
  patch?: string;
}

interface CommitDetail {
  sha: string;
  message: string;
  html_url: string;
  author: { name: string; login?: string; date: string; avatar_url?: string };
  files: CommitFile[];
}

interface CommitDiffViewProps {
  owner: string;
  repo: string;
  filePath?: string;
}

const statusConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  added: { label: 'Added', icon: Plus, color: 'text-green-600' },
  removed: { label: 'Deleted', icon: Minus, color: 'text-red-600' },
  modified: { label: 'Modified', icon: FileEdit, color: 'text-yellow-600' },
  renamed: { label: 'Renamed', icon: FileText, color: 'text-blue-600' },
};

// ─── Diff cell types ───

interface DiffCell {
  num?: number;
  content: string;
  type: 'added' | 'removed' | 'context' | 'hunk' | 'empty';
}

function cellBg(type: string, side?: 'left' | 'right'): string {
  switch (type) {
    case 'added':
      return 'bg-green-50 dark:bg-green-950/30';
    case 'removed':
      return 'bg-red-50 dark:bg-red-950/30';
    case 'hunk':
      return 'bg-blue-50 dark:bg-blue-950/20';
    case 'empty':
      return 'bg-muted/20';
    default:
      return '';
  }
}

function parseSideBySide(patch: string): { left: DiffCell; right: DiffCell }[] {
  const lines = patch.split('\n');
  const rows: { left: DiffCell; right: DiffCell }[] = [];
  let leftNum = 0;
  let rightNum = 0;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith('@@')) {
      const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)/);
      if (match) {
        leftNum = parseInt(match[1], 10);
        rightNum = parseInt(match[2], 10);
      }
      rows.push({
        left: { content: line, type: 'hunk' },
        right: { content: '', type: 'hunk' },
      });
      i++;
      continue;
    }

    // Collect consecutive removed/added blocks to pair them
    if (line.startsWith('-') && !line.startsWith('---')) {
      const removed: string[] = [];
      const added: string[] = [];

      while (i < lines.length && lines[i].startsWith('-') && !lines[i].startsWith('---')) {
        removed.push(lines[i].slice(1));
        i++;
      }
      while (i < lines.length && lines[i].startsWith('+') && !lines[i].startsWith('+++')) {
        added.push(lines[i].slice(1));
        i++;
      }

      const maxLen = Math.max(removed.length, added.length);
      for (let j = 0; j < maxLen; j++) {
        rows.push({
          left:
            j < removed.length
              ? { num: leftNum++, content: removed[j], type: 'removed' }
              : { content: '', type: 'empty' },
          right:
            j < added.length
              ? { num: rightNum++, content: added[j], type: 'added' }
              : { content: '', type: 'empty' },
        });
      }
      continue;
    }

    if (line.startsWith('+') && !line.startsWith('+++')) {
      rows.push({
        left: { content: '', type: 'empty' },
        right: { num: rightNum++, content: line.slice(1), type: 'added' },
      });
      i++;
      continue;
    }

    // Context line
    rows.push({
      left: { num: leftNum++, content: line, type: 'context' },
      right: { num: rightNum++, content: line, type: 'context' },
    });
    i++;
  }

  return rows;
}

// Side-by-side diff table (desktop)
function SideBySideTable({ patch }: { patch: string }) {
  const rows = parseSideBySide(patch);

  return (
    <table className="w-full text-xs font-mono border-collapse">
      <tbody>
        {rows.map((row, i) => {
          if (row.left.type === 'hunk') {
            return (
              <tr key={i} className={cellBg('hunk')}>
                <td colSpan={4} className="px-2 py-0.5 text-blue-600 text-[10px]">
                  {row.left.content}
                </td>
              </tr>
            );
          }
          return (
            <tr key={i}>
              <td
                className={`w-8 text-right pr-1.5 pl-1 select-none text-muted-foreground/60 ${cellBg(row.left.type)}`}
              >
                {row.left.num}
              </td>
              <td
                className={`whitespace-pre-wrap px-2 py-0.5 border-r border-border/50 w-1/2 ${cellBg(row.left.type)}`}
              >
                {row.left.content}
              </td>
              <td
                className={`w-8 text-right pr-1.5 pl-1 select-none text-muted-foreground/60 border-l border-border/50 ${cellBg(row.right.type)}`}
              >
                {row.right.num}
              </td>
              <td className={`whitespace-pre-wrap px-2 py-0.5 w-1/2 ${cellBg(row.right.type)}`}>
                {row.right.content}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// Unified diff table (mobile/tablet)
function UnifiedTable({ patch }: { patch: string }) {
  const lines = patch.split('\n');
  return (
    <table className="w-full text-xs font-mono">
      <tbody>
        {lines.map((line, i) => {
          let bg = '';
          let prefix = ' ';
          let prefixColor = '';
          if (line.startsWith('+') && !line.startsWith('+++')) {
            bg = 'bg-green-50 dark:bg-green-950/30';
            prefix = '+';
            prefixColor = 'text-green-600';
          } else if (line.startsWith('-') && !line.startsWith('---')) {
            bg = 'bg-red-50 dark:bg-red-950/30';
            prefix = '-';
            prefixColor = 'text-red-600';
          } else if (line.startsWith('@@')) {
            bg = 'bg-blue-50 dark:bg-blue-950/20';
            prefixColor = 'text-blue-600';
          }
          return (
            <tr key={i} className={bg}>
              <td className="w-4 select-none text-center">
                {prefixColor ? <span className={prefixColor}>{prefix}</span> : null}
              </td>
              <td className="whitespace-pre-wrap px-2 py-0.5">
                {line.startsWith('+') || line.startsWith('-') ? line.slice(1) : line}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function PatchView({ patch }: { patch: string }) {
  return (
    <>
      {/* Side-by-side on md+ screens */}
      <div className="hidden md:block overflow-x-auto">
        <SideBySideTable patch={patch} />
      </div>
      {/* Unified on small screens */}
      <div className="md:hidden overflow-x-auto">
        <UnifiedTable patch={patch} />
      </div>
    </>
  );
}

// ─── Diff statistics ───

function computeDiffStats(files: CommitFile[]): { additions: number; deletions: number } {
  let additions = 0;
  let deletions = 0;
  for (const file of files) {
    if (!file.patch) continue;
    for (const line of file.patch.split('\n')) {
      if (line.startsWith('+') && !line.startsWith('+++')) additions++;
      if (line.startsWith('-') && !line.startsWith('---')) deletions++;
    }
  }
  return { additions, deletions };
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// ─── Waveform path generation (Catmull-Rom spline) ───

function generateWaveformPath(
  heights: number[],
  width: number,
  height: number
): string {
  if (heights.length === 0) return '';
  if (heights.length === 1) {
    const y = height * (1 - heights[0] * 0.85);
    return `M 0,${y} L ${width},${y} L ${width},${height} L 0,${height} Z`;
  }

  const points: [number, number][] = heights.map((h, i) => [
    (i / (heights.length - 1)) * width,
    height * (1 - h * 0.85),
  ]);

  let d = `M ${points[0][0]},${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;

    d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2[0]},${p2[1]}`;
  }

  d += ` L ${width},${height} L 0,${height} Z`;
  return d;
}

// ─── Lex-style version timeline slider with waveform ───

const SVG_W = 1000;
const SVG_H = 100;

function VersionSlider({
  commits,
  selectedSha,
  onSelect,
  commitCache,
}: {
  commits: GitHubCommit[];
  selectedSha: string | null;
  onSelect: (sha: string) => void;
  commitCache: Map<string, CommitDetail>;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [isActive, setIsActive] = useState(false);
  const hoverIndexRef = useRef<number | null>(null);
  const selectTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const commitCacheRef = useRef(commitCache);
  commitCacheRef.current = commitCache;

  // Reverse so oldest is on the left, newest on the right
  const ordered = useMemo(() => [...commits].reverse(), [commits]);

  const selectedIndex = ordered.findIndex((c) => c.sha === selectedSha);
  const activeIndex = hoverIndex ?? (selectedIndex >= 0 ? selectedIndex : ordered.length - 1);
  const progress = ordered.length > 1 ? activeIndex / (ordered.length - 1) : 1;

  // Waveform heights based on cached diff stats
  const waveformHeights = useMemo(() => {
    return ordered.map((commit) => {
      const cached = commitCache.get(commit.sha);
      if (!cached) return 0.1;
      const stats = computeDiffStats(cached.files);
      return stats.additions + stats.deletions;
    });
  }, [ordered, commitCache]);

  const maxChanges = Math.max(...waveformHeights, 1);
  const normalizedHeights = useMemo(
    () => waveformHeights.map((h) => Math.max(0.06, h / maxChanges)),
    [waveformHeights, maxChanges]
  );

  const waveformPath = useMemo(
    () => generateWaveformPath(normalizedHeights, SVG_W, SVG_H),
    [normalizedHeights]
  );

  const getIndexFromX = useCallback(
    (clientX: number): number => {
      if (!trackRef.current || ordered.length <= 1) return 0;
      const rect = trackRef.current.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return Math.round(ratio * (ordered.length - 1));
    },
    [ordered.length]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      trackRef.current?.setPointerCapture(e.pointerId);
      setIsDragging(true);
      setIsActive(true);
      const idx = getIndexFromX(e.clientX);
      hoverIndexRef.current = idx;
      setHoverIndex(idx);
      // Immediately select the clicked commit
      if (ordered[idx]) onSelect(ordered[idx].sha);
    },
    [getIndexFromX, ordered, onSelect]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return;
      const idx = getIndexFromX(e.clientX);
      if (idx !== hoverIndexRef.current) {
        hoverIndexRef.current = idx;
        setHoverIndex(idx);
        // Update diff in real-time: instant for cached, debounced for uncached
        if (selectTimerRef.current) clearTimeout(selectTimerRef.current);
        const sha = ordered[idx]?.sha;
        if (sha) {
          if (commitCacheRef.current.has(sha)) {
            onSelect(sha);
          } else {
            selectTimerRef.current = setTimeout(() => onSelect(sha), 120);
          }
        }
      }
    },
    [isDragging, getIndexFromX, ordered, onSelect]
  );

  const handlePointerUp = useCallback(() => {
    if (selectTimerRef.current) clearTimeout(selectTimerRef.current);
    if (isDragging && hoverIndexRef.current !== null && ordered[hoverIndexRef.current]) {
      onSelect(ordered[hoverIndexRef.current].sha);
    }
    setIsDragging(false);
    hoverIndexRef.current = null;
    setHoverIndex(null);
    setTimeout(() => setIsActive(false), 600);
  }, [isDragging, ordered, onSelect]);

  // Clean up timer
  useEffect(() => {
    return () => {
      if (selectTimerRef.current) clearTimeout(selectTimerRef.current);
    };
  }, []);

  if (ordered.length <= 1) return null;

  const displayCommit = ordered[activeIndex];
  const cached = displayCommit ? commitCache.get(displayCommit.sha) : null;
  const stats = cached ? computeDiffStats(cached.files) : null;

  // Tooltip alignment: shift based on position to keep in view
  const tooltipTransform =
    progress < 0.15
      ? 'translateX(0%)'
      : progress > 0.85
        ? 'translateX(-100%)'
        : 'translateX(-50%)';

  const expanded = isActive || isDragging;

  return (
    <div
      className="relative border-b px-4 pt-1 pb-2"
      onMouseEnter={() => setIsActive(true)}
      onMouseLeave={() => {
        if (!isDragging) setIsActive(false);
      }}
    >
      {/* Labels - visible when expanded */}
      <div
        className={`flex items-center justify-between overflow-hidden transition-all duration-300 ${
          expanded ? 'max-h-8 opacity-100 mb-1.5' : 'max-h-0 opacity-0 mb-0'
        }`}
      >
        <span className="text-[11px] text-muted-foreground">
          Version {activeIndex + 1} of {ordered.length}
        </span>
        {selectedIndex < ordered.length - 1 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-5 text-[11px] gap-1 px-1.5"
            onClick={() => onSelect(ordered[ordered.length - 1].sha)}
          >
            View latest
            <ChevronsRight className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Waveform track */}
      <div
        ref={trackRef}
        className="relative cursor-pointer touch-none select-none overflow-visible"
        style={{ height: expanded ? 24 : 3, transition: 'height 0.3s ease-out' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <svg
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full overflow-visible"
        >
          <defs>
            <clipPath id="wf-progress">
              <rect x="0" y="0" width={progress * SVG_W} height={SVG_H} />
            </clipPath>
            <clipPath id="wf-remaining">
              <rect x={progress * SVG_W} y="0" width={(1 - progress) * SVG_W} height={SVG_H} />
            </clipPath>
          </defs>
          {/* Gray portion (after handle) */}
          <path d={waveformPath} className="fill-muted" clipPath="url(#wf-remaining)" />
          {/* Green portion (before handle) */}
          <path
            d={waveformPath}
            className="fill-green-500"
            clipPath="url(#wf-progress)"
          />
        </svg>

        {/* Handle */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full bg-white border-2 border-green-500 shadow-md z-10 transition-[left] duration-75"
          style={{
            left: `${progress * 100}%`,
            width: expanded ? 14 : 8,
            height: expanded ? 14 : 8,
          }}
        />

        {/* Tooltip on drag */}
        {isDragging && displayCommit && (
          <div
            className="absolute bottom-full mb-2 rounded-lg bg-popover border shadow-lg px-3 py-2 pointer-events-none z-50"
            style={{
              left: `${progress * 100}%`,
              transform: tooltipTransform,
            }}
          >
            <p className="text-xs font-semibold whitespace-nowrap">
              {formatRelativeTime(displayCommit.author.date)}
            </p>
            {stats ? (
              <div className="mt-0.5">
                <p className="text-[11px] text-green-500 whitespace-nowrap">
                  {stats.additions} addition{stats.additions !== 1 ? 's' : ''}{' '}
                  <span className="text-green-400/70">+++</span>
                </p>
                <p className="text-[11px] text-red-400 whitespace-nowrap">
                  {stats.deletions} deletion{stats.deletions !== 1 ? 's' : ''}{' '}
                  <span className="text-red-300/70">---</span>
                </p>
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground truncate max-w-[200px]">
                {displayCommit.message.split('\n')[0]}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function CommitDiffView({ owner, repo, filePath }: CommitDiffViewProps) {
  const { diffViewCommitSha, setDiffViewCommitSha } = useUIStore();
  const { fetchCommit, commits: sliderCommits, fetchCommits: fetchSliderCommits } = useGitHubCommits();
  const [commit, setCommit] = useState<CommitDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [commitCache, setCommitCache] = useState<Map<string, CommitDetail>>(new Map());
  const latestCacheRef = useRef(commitCache);
  latestCacheRef.current = commitCache;

  // Fetch commits list for the slider
  useEffect(() => {
    if (diffViewCommitSha) {
      fetchSliderCommits(owner, repo, filePath);
    }
  }, [diffViewCommitSha, owner, repo, filePath, fetchSliderCommits]);

  // Fetch single commit detail (with caching)
  useEffect(() => {
    if (!diffViewCommitSha) {
      setCommit(null);
      return;
    }
    const cached = latestCacheRef.current.get(diffViewCommitSha);
    if (cached) {
      setCommit(cached);
      setLoading(false);
      return;
    }
    // Keep previous commit visible while loading (no setCommit(null))
    setLoading(true);
    fetchCommit(owner, repo, diffViewCommitSha)
      .then((data) => {
        if (data) {
          const detail = data as CommitDetail;
          setCommit(detail);
          setCommitCache((prev) => new Map(prev).set(detail.sha, detail));
        }
      })
      .catch(() => toast.error('Failed to load commit diff'))
      .finally(() => setLoading(false));
  }, [diffViewCommitSha, owner, repo, fetchCommit]);

  const handleClose = useCallback(() => {
    setDiffViewCommitSha(null);
  }, [setDiffViewCommitSha]);

  const handleSliderSelect = useCallback(
    (sha: string) => {
      setDiffViewCommitSha(sha);
    },
    [setDiffViewCommitSha]
  );

  const diffStats = commit ? computeDiffStats(commit.files) : null;

  if (!diffViewCommitSha) return null;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <Badge variant="outline" className="font-mono text-xs shrink-0">
            {diffViewCommitSha.slice(0, 7)}
          </Badge>
          {commit && (
            <span className="text-sm font-medium truncate">{commit.message.split('\n')[0]}</span>
          )}
          {diffStats && (
            <span className="flex items-center gap-2 text-xs shrink-0">
              <span className="flex items-center gap-0.5 text-green-600 dark:text-green-400">
                <Plus className="h-3 w-3" />
                {diffStats.additions}
              </span>
              <span className="flex items-center gap-0.5 text-red-500">
                <Minus className="h-3 w-3" />
                {diffStats.deletions}
              </span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {commit?.html_url && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1.5"
              onClick={() => window.open(commit.html_url, '_blank')}
            >
              <ExternalLink className="h-3 w-3" />
              View on GitHub
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleClose}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Version timeline slider */}
      {sliderCommits.length > 1 && (
        <VersionSlider
          commits={sliderCommits}
          selectedSha={diffViewCommitSha}
          onSelect={handleSliderSelect}
          commitCache={commitCache}
        />
      )}

      {/* Content - keep previous diff visible while loading new one */}
      {!commit && loading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : commit ? (
        <ScrollArea className={`flex-1 transition-opacity duration-200 ${loading ? 'opacity-40' : 'opacity-100'}`}>
          <div className="p-4 space-y-4">
            {commit.files.map((file) => {
              const config = statusConfig[file.status] || statusConfig.modified;
              const Icon = config.icon;
              return (
                <div key={file.filename} className="rounded-lg border overflow-hidden">
                  <div className="flex items-center gap-2 border-b bg-muted/30 px-3 py-2">
                    <Icon className={`h-3.5 w-3.5 ${config.color}`} />
                    <span className="text-xs font-mono font-medium truncate">{file.filename}</span>
                    <Badge variant="outline" className="text-[10px] ml-auto shrink-0">
                      {config.label}
                    </Badge>
                  </div>
                  {file.patch ? (
                    <PatchView patch={file.patch} />
                  ) : (
                    <div className="p-3 text-xs text-muted-foreground text-center">
                      Binary file or no diff available
                    </div>
                  )}
                </div>
              );
            })}
            {commit.files.length === 0 && (
              <div className="text-center text-sm text-muted-foreground py-8">
                No file changes in this commit
              </div>
            )}
          </div>
        </ScrollArea>
      ) : null}
    </div>
  );
}
