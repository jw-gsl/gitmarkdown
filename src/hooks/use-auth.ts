'use client';

import { useAuth } from '@/providers/auth-provider';
import { signInWithGitHub, signOut } from '@/lib/firebase/auth';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

export function useAuthActions() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const login = useCallback(async () => {
    try {
      await signInWithGitHub();
      router.push('/dashboard');
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  }, [router]);

  const logout = useCallback(async () => {
    try {
      await signOut();
      router.push('/');
    } catch (error) {
      console.error('Logout failed:', error);
      throw error;
    }
  }, [router]);

  return {
    user,
    loading,
    isAuthenticated: !!user,
    login,
    logout,
  };
}
