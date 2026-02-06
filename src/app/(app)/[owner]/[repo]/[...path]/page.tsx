'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { TiptapEditor } from '@/components/editor/tiptap-editor';
import { EditorHeader } from '@/components/editor/editor-header';
import { useGitHubContent } from '@/hooks/use-github';
import { useFileStore } from '@/stores/file-store';
import { useSyncStore } from '@/stores/sync-store';
import { isMarkdownFile } from '@/lib/editor/markdown-serializer';
import { saveFile } from '@/lib/firebase/firestore';
import { toast } from 'sonner';

export default function FileEditorPage() {
  const params = useParams();
  const owner = params.owner as string;
  const repo = params.repo as string;
  const pathSegments = params.path as string[];
  const filePath = pathSegments.join('/');

  const { loading, fetchContent, updateContent } = useGitHubContent();
  const { setCurrentFile, currentFile, markDirty, markClean, syncStatus } = useFileStore();
  const { currentBranch } = useSyncStore();

  const [content, setContent] = useState<string>('');
  const [sha, setSha] = useState<string>('');
  const [isDirty, setIsDirty] = useState(false);
  const [isPreview, setIsPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fileLoading, setFileLoading] = useState(true);

  const isMarkdown = isMarkdownFile(filePath);

  useEffect(() => {
    const loadContent = async () => {
      setFileLoading(true);
      try {
        const fileData = await fetchContent(owner, repo, filePath, currentBranch);
        if (fileData) {
          const decoded = fileData.encoding === 'base64'
            ? atob(fileData.content.replace(/\n/g, ''))
            : fileData.content;
          setContent(decoded);
          setSha(fileData.sha);
          setCurrentFile({
            id: fileData.sha,
            path: filePath,
            name: fileData.name,
            type: 'file',
            sha: fileData.sha,
            isMarkdown,
            content: decoded,
          });
          setIsDirty(false);
        }
      } catch (error) {
        toast.error('Failed to load file');
      } finally {
        setFileLoading(false);
      }
    };
    loadContent();
  }, [owner, repo, filePath, currentBranch]);

  const handleContentChange = useCallback(
    (newContent: string) => {
      setContent(newContent);
      setIsDirty(true);
      markDirty(filePath);
    },
    [filePath, markDirty]
  );

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const result = await updateContent(
        owner,
        repo,
        filePath,
        content,
        `Update ${filePath}`,
        sha,
        currentBranch
      );
      setSha(result.sha);
      setIsDirty(false);
      markClean(filePath);
      toast.success('File saved');
    } catch (error) {
      toast.error('Failed to save file');
    } finally {
      setSaving(false);
    }
  }, [owner, repo, filePath, content, sha, currentBranch, updateContent, markClean]);

  // Keyboard shortcut for save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (isDirty) handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDirty, handleSave]);

  if (fileLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <EditorHeader
        filePath={filePath}
        isDirty={isDirty}
        syncStatus={syncStatus}
        isPreview={isPreview}
        onSave={handleSave}
        onTogglePreview={() => setIsPreview(!isPreview)}
        saving={saving}
      />
      {isMarkdown ? (
        isPreview ? (
          <div className="prose prose-sm dark:prose-invert mx-auto max-w-none p-8">
            <div dangerouslySetInnerHTML={{ __html: content }} />
          </div>
        ) : (
          <TiptapEditor
            content={content}
            onChange={handleContentChange}
            className="flex-1 overflow-auto"
          />
        )
      ) : (
        <div className="flex-1 overflow-auto">
          <pre className="p-6 font-mono text-sm">{content}</pre>
        </div>
      )}
    </div>
  );
}
