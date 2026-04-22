import styles from './Header.module.css';
import Image from 'next/image';

export default function Header({ user }) {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <div className={styles.logoWrap}>
          <Image
            src="/logo.jpg"
            alt="CTTMO Logo"
            width={44}
            height={44}
            className={styles.logo}
            unoptimized
          />
        </div>
        <div className={styles.titles}>
          <div className={styles.titleSmall}>City Transport and Traffic Management Office</div>
          <div className={styles.titleMedium}>Transport Planning and Management Division</div>
          <div className={styles.titleLarge}>PerfMon: Unified Performance Monitoring System</div>
        </div>
        {user && (
          <div className={styles.userBadge}>
            <span className={styles.userName}>{user.displayName || user.email?.split('@')[0]}</span>
            <span className={styles.userRole}>{user.role?.toUpperCase()}</span>
          </div>
        )}
      </div>
    </header>
  );
}
