'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function CallbackPage() {
  const router = useRouter();

  useEffect(() => {
    // Firebase handles the OAuth callback automatically
    // This page just shows a loading state while redirecting
    const timer = setTimeout(() => {
      router.push('/dashboard');
    }, 2000);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Completing sign in...</p>
      </div>
    </div>
  );
}
