'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Github, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { signInWithGitHub } from '@/lib/firebase/auth';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithGitHub();
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card data-testid="login-card" className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <FileText className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Welcome to GitMarkdown</CardTitle>
          <CardDescription>
            Sign in with your GitHub account to start editing your markdown files collaboratively.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            data-testid="github-sign-in-button"
            aria-label="Sign in with GitHub to access GitMarkdown"
            aria-busy={loading}
            onClick={handleLogin}
            disabled={loading}
            className="w-full"
            size="lg"
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Github className="mr-2 h-4 w-4" />
            )}
            {loading ? 'Signing in...' : 'Continue with GitHub'}
          </Button>
          {error && (
            <p data-testid="login-error" role="alert" aria-live="assertive" className="text-center text-sm text-destructive">{error}</p>
          )}
          <p className="text-center text-xs text-muted-foreground">
            We&apos;ll request access to your repositories so you can sync your markdown files.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
