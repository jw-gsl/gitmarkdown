import { type Editor } from '@tiptap/react';

export function getMarkdownFromEditor(editor: Editor): string {
  // tiptap-markdown extension provides this via storage
  return (editor.storage as Record<string, any>).markdown?.getMarkdown() || '';
}

export function setMarkdownInEditor(editor: Editor, markdown: string): void {
  editor.commands.setContent(markdown);
}

export function isMarkdownFile(filename: string): boolean {
  const mdExtensions = ['.md', '.mdx', '.markdown', '.mdown', '.mkd', '.mkdn'];
  return mdExtensions.some((ext) => filename.toLowerCase().endsWith(ext));
}
