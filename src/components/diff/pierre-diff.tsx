'use client';

import { useMemo, type ReactNode } from 'react';
import { PatchDiff, MultiFileDiff } from '@pierre/diffs/react';
import type { DiffLineAnnotation } from '@pierre/diffs';
import { useTheme } from 'next-themes';
import { useUIStore } from '@/stores/ui-store';

type DiffStyle = 'unified' | 'split';

interface PierrePatchDiffViewProps<T = undefined> {
  patch: string;
  fileName?: string;
  viewMode?: DiffStyle;
  className?: string;
  lineAnnotations?: DiffLineAnnotation<T>[];
  renderAnnotation?: (annotation: DiffLineAnnotation<T>) => ReactNode;
}

/**
 * GitHub API returns just hunk content (@@ ... @@), but PatchDiff expects
 * a full unified diff with headers. Prepend them if missing.
 */
function ensureFullPatch(patch: string, fileName: string): string {
  if (patch.startsWith('diff ') || patch.startsWith('--- ')) {
    return patch;
  }
  return `--- a/${fileName}\n+++ b/${fileName}\n${patch}`;
}

interface PierreContentDiffViewProps<T = undefined> {
  oldContent: string;
  newContent: string;
  fileName?: string;
  viewMode?: DiffStyle;
  className?: string;
  lineAnnotations?: DiffLineAnnotation<T>[];
  renderAnnotation?: (annotation: DiffLineAnnotation<T>) => ReactNode;
}

function useDiffThemeType(): 'light' | 'dark' {
  const { resolvedTheme } = useTheme();
  return resolvedTheme === 'dark' ? 'dark' : 'light';
}

function useDiffTheme(): { dark: string; light: string } {
  return { dark: 'github-dark', light: 'github-light' };
}

function useDiffStyle(viewModeProp?: DiffStyle): DiffStyle {
  const storeMode = useUIStore((s) => s.diffViewMode);
  return viewModeProp ?? storeMode;
}

export function PierrePatchDiffView<T = undefined>({
  patch,
  fileName = 'file',
  viewMode,
  className,
  lineAnnotations,
  renderAnnotation,
}: PierrePatchDiffViewProps<T>) {
  const theme = useDiffTheme();
  const themeType = useDiffThemeType();
  const diffStyle = useDiffStyle(viewMode);

  const fullPatch = useMemo(
    () => ensureFullPatch(patch, fileName),
    [patch, fileName]
  );

  const options = useMemo(
    () => ({
      diffStyle,
      theme,
      lineDiffType: 'word' as const,
      overflow: 'wrap' as const,
      themeType,
      disableFileHeader: true,
    }),
    [diffStyle, theme, themeType]
  );

  if (!patch) return null;

  return (
    <PatchDiff
      patch={fullPatch}
      options={options}
      className={className}
      lineAnnotations={lineAnnotations}
      renderAnnotation={renderAnnotation}
    />
  );
}

export function PierreContentDiffView<T = undefined>({
  oldContent,
  newContent,
  fileName = 'file',
  viewMode,
  className,
  lineAnnotations,
  renderAnnotation,
}: PierreContentDiffViewProps<T>) {
  const theme = useDiffTheme();
  const themeType = useDiffThemeType();
  const diffStyle = useDiffStyle(viewMode);

  const oldFile = useMemo(
    () => ({ name: fileName, contents: oldContent }),
    [fileName, oldContent]
  );
  const newFile = useMemo(
    () => ({ name: fileName, contents: newContent }),
    [fileName, newContent]
  );

  const options = useMemo(
    () => ({
      diffStyle,
      theme,
      lineDiffType: 'word' as const,
      overflow: 'wrap' as const,
      themeType,
      disableFileHeader: true,
    }),
    [diffStyle, theme, themeType]
  );

  return (
    <MultiFileDiff
      oldFile={oldFile}
      newFile={newFile}
      options={options}
      className={className}
      lineAnnotations={lineAnnotations}
      renderAnnotation={renderAnnotation}
    />
  );
}
