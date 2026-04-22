'use client';
import styles from './AppShell.module.css';
import Header from './Header';
import BottomNav from './BottomNav';
import TopNav from './TopNav';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function AppShell({ children }) {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user === null) {
      router.push('/login');
    }
  }, [user, router]);

  if (user === undefined) {
    return (
      <div className="loading-center">
        <div className="spinner" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className={styles.shell}>
      <Header user={user} />
      <TopNav user={user} />
      <main className={styles.main}>
        <div className={styles.content}>
          {children}
        </div>
      </main>
      <BottomNav user={user} />
      <div className="mobile-nav-spacer" />
    </div>
  );
}
