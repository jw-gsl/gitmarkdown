'use client';

import { useParams } from 'next/navigation';
import { GitBranch, FileText, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFileStore } from '@/stores/file-store';
import { useSyncStore } from '@/stores/sync-store';

export default function RepoOverviewPage() {
  const params = useParams();
  const owner = params.owner as string;
  const repo = params.repo as string;
  const { files } = useFileStore();
  const { currentBranch } = useSyncStore();

  const totalFiles = files.reduce((acc, f) => acc + (f.type === 'file' ? 1 : 0), 0);
  const mdFiles = files.reduce((acc, f) => acc + (f.isMarkdown ? 1 : 0), 0);

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="mb-2 text-2xl font-bold">{owner}/{repo}</h1>
      <p className="mb-8 text-muted-foreground">Select a file from the sidebar to start editing.</p>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <FileText className="h-4 w-4" />
              Files
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalFiles}</div>
            <p className="text-xs text-muted-foreground">{mdFiles} markdown files</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <GitBranch className="h-4 w-4" />
              Branch
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currentBranch}</div>
            <p className="text-xs text-muted-foreground">Current branch</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Users className="h-4 w-4" />
              Collaborators
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1</div>
            <p className="text-xs text-muted-foreground">Active now</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
