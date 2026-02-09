'use client';

import { useState } from 'react';
import {
  Download,
  FileText,
  Code2,
  Copy,
  Link2,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { toast } from 'sonner';

interface ExportDropdownProps {
  content: string;
  filename: string;
  isMarkdown: boolean;
  /** Button size variant: 'default' (h-8) or 'sm' (h-7) */
  size?: 'default' | 'sm';
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function markdownToBasicHtml(markdown: string, title: string): string {
  // Try to get HTML from the Tiptap editor DOM if available
  const editorEl = document.querySelector('#tiptap-editor .ProseMirror');
  const bodyHtml = editorEl
    ? editorEl.innerHTML
    : `<pre>${markdown.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title.replace(/</g, '&lt;')}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; max-width: 800px; margin: 2rem auto; padding: 0 1rem; line-height: 1.6; color: #1f2328; }
    h1 { border-bottom: 1px solid #d1d9e0; padding-bottom: 0.3em; }
    h2 { border-bottom: 1px solid #d1d9e0; padding-bottom: 0.25em; }
    pre { background: #f6f8fa; border-radius: 6px; padding: 1rem; overflow-x: auto; }
    code { background: #eff1f3; border-radius: 3px; padding: 0.15em 0.3em; font-size: 85%; }
    pre code { background: none; padding: 0; }
    blockquote { border-left: 3px solid #d1d9e0; padding-left: 1rem; color: #656d76; margin: 0.5rem 0; }
    table { border-collapse: collapse; width: 100%; }
    td, th { border: 1px solid #d1d9e0; padding: 0.5rem; }
    th { background: #f6f8fa; font-weight: 600; }
    img { max-width: 100%; }
    hr { border: none; border-top: 1px solid #d1d9e0; margin: 1.5rem 0; }
  </style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

async function copyHtmlToClipboard(html: string): Promise<boolean> {
  try {
    const blob = new Blob([html], { type: 'text/html' });
    await navigator.clipboard.write([
      new ClipboardItem({ 'text/html': blob }),
    ]);
    return true;
  } catch {
    // Fallback: copy as plain text
    try {
      await navigator.clipboard.writeText(html);
      return true;
    } catch {
      return false;
    }
  }
}

export function ExportDropdown({ content, filename, isMarkdown, size = 'default' }: ExportDropdownProps) {
  const [copied, setCopied] = useState<string | null>(null);

  const showCopied = (key: string) => {
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleDownloadMarkdown = () => {
    const name = filename.endsWith('.md') ? filename : `${filename}.md`;
    downloadFile(content, name, 'text/markdown');
    toast.success(`Downloaded ${name}`);
  };

  const handleDownloadHtml = () => {
    const title = filename.replace(/\.[^.]+$/, '');
    const html = markdownToBasicHtml(content, title);
    const name = filename.replace(/\.[^.]+$/, '.html');
    downloadFile(html, name, 'text/html');
    toast.success(`Downloaded ${name}`);
  };

  const handleCopyHtml = async () => {
    const editorEl = document.querySelector('#tiptap-editor .ProseMirror');
    const html = editorEl
      ? editorEl.innerHTML
      : content;
    const ok = await copyHtmlToClipboard(html);
    if (ok) {
      showCopied('html');
      toast.success('HTML copied to clipboard');
    } else {
      toast.error('Failed to copy HTML');
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      showCopied('link');
      toast.success('Link copied to clipboard');
    } catch {
      toast.error('Failed to copy link');
    }
  };

  const handleDownloadFile = () => {
    const ext = filename.split('.').pop() || 'txt';
    const mimeMap: Record<string, string> = {
      json: 'application/json',
      js: 'text/javascript',
      ts: 'text/typescript',
      tsx: 'text/typescript',
      jsx: 'text/javascript',
      css: 'text/css',
      html: 'text/html',
      xml: 'application/xml',
      yaml: 'text/yaml',
      yml: 'text/yaml',
      toml: 'text/toml',
      py: 'text/x-python',
      rb: 'text/x-ruby',
      go: 'text/x-go',
      rs: 'text/x-rust',
      sh: 'text/x-shellscript',
      txt: 'text/plain',
    };
    const mimeType = mimeMap[ext] || 'text/plain';
    downloadFile(content, filename, mimeType);
    toast.success(`Downloaded ${filename}`);
  };

  const handleCopyContent = async () => {
    try {
      await navigator.clipboard.writeText(content);
      showCopied('content');
      toast.success('Content copied to clipboard');
    } catch {
      toast.error('Failed to copy content');
    }
  };

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <DropdownMenu>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={size === 'sm' ? 'h-7 w-7' : 'h-8 w-8'}
                data-testid="export-dropdown-trigger"
                aria-label="Export and share options"
              >
                <Download className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-[18px] w-[18px]'} />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p className="text-xs">Export & Share</p>
          </TooltipContent>

          <DropdownMenuContent align="end" className="w-52">
            {isMarkdown ? (
              <>
                <DropdownMenuItem onSelect={handleCopyHtml} data-testid="export-copy-html">
                  {copied === 'html' ? (
                    <Check className="h-4 w-4 mr-2 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4 mr-2" />
                  )}
                  Copy
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={handleDownloadMarkdown} data-testid="export-download-md">
                  <FileText className="h-4 w-4 mr-2" />
                  Download as .md
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={handleDownloadHtml} data-testid="export-download-html">
                  <Code2 className="h-4 w-4 mr-2" />
                  Download as HTML
                </DropdownMenuItem>
              </>
            ) : (
              <>
                <DropdownMenuItem onSelect={handleCopyContent} data-testid="export-copy-content">
                  {copied === 'content' ? (
                    <Check className="h-4 w-4 mr-2 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4 mr-2" />
                  )}
                  Copy
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={handleDownloadFile} data-testid="export-download-file">
                  <Download className="h-4 w-4 mr-2" />
                  Download file
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={handleCopyLink} data-testid="export-copy-link">
              {copied === 'link' ? (
                <Check className="h-4 w-4 mr-2 text-green-500" />
              ) : (
                <Link2 className="h-4 w-4 mr-2" />
              )}
              Copy link
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </Tooltip>
    </TooltipProvider>
  );
}
