'use client';

import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { computeLineDiff, type DiffLine } from '@/lib/utils/diff';
import { cn } from '@/lib/utils';

interface DiffViewProps {
  original: string;
  modified: string;
  onAccept?: () => void;
  onReject?: () => void;
  showActions?: boolean;
  className?: string;
}

export function DiffView({ original, modified, onAccept, onReject, showActions = true, className }: DiffViewProps) {
  const diffLines = computeLineDiff(original, modified);

  return (
    <div className={cn("rounded-lg border overflow-hidden", className)}>
      <div className="max-h-96 overflow-auto">
        <table className="w-full text-xs font-mono">
          <tbody>
            {diffLines.map((line, i) => (
              <tr
                key={i}
                className={
                  line.type === 'added'
                    ? 'bg-green-50 dark:bg-green-950/30'
                    : line.type === 'removed'
                    ? 'bg-red-50 dark:bg-red-950/30'
                    : ''
                }
              >
                <td className="w-10 select-none px-2 text-right text-muted-foreground/50">
                  {line.lineNumber.old || ''}
                </td>
                <td className="w-10 select-none px-2 text-right text-muted-foreground/50">
                  {line.lineNumber.new || ''}
                </td>
                <td className="w-4 select-none text-center">
                  {line.type === 'added' ? (
                    <span className="text-green-600">+</span>
                  ) : line.type === 'removed' ? (
                    <span className="text-red-600">-</span>
                  ) : null}
                </td>
                <td className="whitespace-pre-wrap px-2 py-0.5">{line.content}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showActions && (
        <div className="flex justify-end gap-2 border-t p-2">
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onReject}>
            <X className="mr-1 h-3 w-3" />
            Reject
          </Button>
          <Button size="sm" className="h-7 text-xs" onClick={onAccept}>
            <Check className="mr-1 h-3 w-3" />
            Accept
          </Button>
        </div>
      )}
    </div>
  );
}
