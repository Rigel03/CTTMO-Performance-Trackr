'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

export default function RootPage() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user === undefined) return;
    if (user) {
      router.replace('/home');
    } else {
      router.replace('/login');
    }
  }, [user, router]);

  return (
    <div className="loading-center">
      <div className="spinner" />
    </div>
  );
}
