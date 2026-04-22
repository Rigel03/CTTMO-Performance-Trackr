'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './BottomNav.module.css';
import { useAuth } from '@/hooks/useAuth';

// types: 'all' = show for everyone, 'plantilla' = Plantilla only, 'jo_cos' = JO/COS only
const ALL_NAV = [
  { href: '/home',      label: 'Home',      icon: '🏠', types: ['all'] },
  { href: '/my-ipcr',  label: 'My IPCR',   icon: '📝', types: ['plantilla'] },
  { href: '/tracker',  label: 'Tracker',   icon: '📊', types: ['jo_cos'] },
  { href: '/dashboard', label: 'Analytics', icon: '📈', types: ['plantilla'] },
  { href: '/profile',   label: 'Profile',   icon: '👤', types: ['all'] },
];

const ADMIN_ITEM = { href: '/admin', label: 'Admin', icon: '⚙️' };

export default function BottomNav({ user }) {
  const pathname = usePathname();

  const empType = user?.employmentType;
  const isAdmin = user?.role === 'admin';

  const items = [
    ...ALL_NAV.filter(item =>
      isAdmin ||
      item.types.includes('all') ||
      (empType && item.types.includes(empType))
    ),
    ...(isAdmin ? [ADMIN_ITEM] : []),
  ];

  return (
    <nav className={styles.nav}>
      {items.map(item => {
        const active = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`${styles.item} ${active ? styles.active : ''}`}
          >
            <span className={styles.icon}>{item.icon}</span>
            <span className={styles.label}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
