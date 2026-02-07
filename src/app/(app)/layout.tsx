'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { AuthProvider, useAuth } from '@/providers/auth-provider';
import { SidebarProvider } from '@/components/ui/sidebar';
import { useSettingsSync } from '@/hooks/use-settings-sync';

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Sync settings between localStorage and Firestore
  useSettingsSync();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  return <>{children}</>;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AuthGuard>
        <SidebarProvider>
          <div className="flex h-screen w-full overflow-hidden">
            {children}
          </div>
        </SidebarProvider>
      </AuthGuard>
    </AuthProvider>
  );
}
