import { diffLines, diffWords, type Change } from 'diff';

export interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  content: string;
  lineNumber: { old?: number; new?: number };
}

export function computeLineDiff(oldText: string, newText: string): DiffLine[] {
  const changes = diffLines(oldText, newText);
  const result: DiffLine[] = [];
  let oldLine = 1;
  let newLine = 1;

  for (const change of changes) {
    const lines = change.value.split('\n').filter((_, i, arr) => i < arr.length - 1 || change.value.slice(-1) !== '\n' ? true : i < arr.length - 1);

    for (const line of lines) {
      if (change.added) {
        result.push({ type: 'added', content: line, lineNumber: { new: newLine++ } });
      } else if (change.removed) {
        result.push({ type: 'removed', content: line, lineNumber: { old: oldLine++ } });
      } else {
        result.push({ type: 'unchanged', content: line, lineNumber: { old: oldLine++, new: newLine++ } });
      }
    }
  }

  return result;
}

export function computeWordDiff(oldText: string, newText: string): Change[] {
  return diffWords(oldText, newText);
}
