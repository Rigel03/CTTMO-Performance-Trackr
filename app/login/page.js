'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { loginUser } from '@/lib/auth';
import styles from './page.module.css';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await loginUser(email, password);
      router.push('/home');
    } catch (err) {
      const msg = err?.message || '';
      if (msg.includes('Invalid login credentials')) {
        setError('Invalid credentials. Please verify your email and password.');
      } else if (msg.includes('Email not confirmed')) {
        setError('Your email has not been confirmed yet.');
      } else if (msg.includes('rate limit') || msg.includes('Too many requests')) {
        setError('Account temporarily locked due to too many attempts. Try again later.');
      } else if (msg.includes('Failed to fetch')) {
        setError('Network error. Check your connection.');
      } else {
        setError(`Authentication error: ${msg || 'Unknown error'}`);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.main}>
      <div className={styles.card}>
        <div className={styles.logoWrap}>
          <Image src="/logo.jpg" alt="CTTMO Logo" width={80} height={80} className={styles.logo} unoptimized />
        </div>

        <div className={styles.headerText}>
          <p className={styles.orgSmall}>City Transport and Traffic Management Office</p>
          <p className={styles.orgMedium}>Transport Planning and Management Division</p>
          <h1 className={styles.appTitle}>PerfMon</h1>
          <p className={styles.subtitle}>Unified Performance Monitoring System</p>
        </div>

        <div className={styles.divider} />

        <form onSubmit={handleLogin} className={styles.form}>
          {error && <div className="alert alert-error">{error}</div>}

          <div className="form-group">
            <label className="form-label" htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              className="form-control"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="officer@cttmo.gov.ph"
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <div className={styles.passwordWrap}>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                className={`form-control ${styles.passwordInput}`}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                className={styles.showPasswordBtn}
                onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                tabIndex={-1}
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? 'Verifying Identity...' : 'Sign In to System'}
          </button>
        </form>

        <p className={styles.footer}>
          Access restricted to authorized TPMD personnel only.
        </p>
      </div>
    </main>
  );
}
