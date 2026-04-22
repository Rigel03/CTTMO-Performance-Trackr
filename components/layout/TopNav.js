'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import styles from './TopNav.module.css';
import { logoutUser } from '@/lib/auth';

// types: 'all' = show for everyone, 'plantilla' = Plantilla only, 'jo_cos' = JO/COS only
const ALL_NAV = [
  { href: '/home',      label: '🏠 Home',       types: ['all'] },
  { href: '/my-ipcr',  label: '📝 My IPCR',    types: ['plantilla'] },
  { href: '/tracker',  label: '📊 Tracker',    types: ['jo_cos'] },
  { href: '/dashboard', label: '📈 Analytics', types: ['plantilla'] },
  { href: '/profile',   label: '👤 Profile',   types: ['all'] },
];

export default function TopNav({ user }) {
  const pathname = usePathname();
  const router = useRouter();

  const empType = user?.employmentType; // 'plantilla' | 'jo_cos' | null
  const isAdmin = user?.role === 'admin';

  const items = [
    ...ALL_NAV.filter(item =>
      isAdmin ||
      item.types.includes('all') ||
      (empType && item.types.includes(empType))
    ),
    ...(isAdmin ? [{ href: '/admin', label: '⚙️ Admin' }] : []),
  ];

  async function handleLogout() {
    await logoutUser();
    router.push('/login');
  }

  return (
    <nav className={styles.nav}>
      <div className={styles.inner}>
        <div className={styles.links}>
          {items.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.link} ${pathname.startsWith(item.href) ? styles.active : ''}`}
            >
              {item.label}
            </Link>
          ))}
        </div>
        <button className={`btn btn-outline btn-sm ${styles.logout}`} onClick={handleLogout}>
          Sign Out
        </button>
      </div>
    </nav>
  );
}
