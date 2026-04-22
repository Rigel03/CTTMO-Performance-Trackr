'use client';
import { useEffect, useState } from 'react';
import AppShell from '@/components/layout/AppShell';
import { useAuth } from '@/hooks/useAuth';
import { getRecords } from '@/lib/db/records';
import { getEmployees } from '@/lib/db/employees';
import { getMFOs } from '@/lib/db/mfos';
import { getLogsForEmployee } from '@/lib/db/indicatorLogs';
import { getIndicators, getEmployeeIndicators } from '@/lib/db/indicators';
import styles from './page.module.css';
import Link from 'next/link';

const NOW = new Date();
const CUR_YEAR = NOW.getFullYear();
const CUR_MONTH = NOW.getMonth(); // 0-indexed
const CUR_MONTH_STR = String(CUR_MONTH + 1).padStart(2, '0');
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const CUR_QUARTER = CUR_MONTH < 3 ? 'Q1' : CUR_MONTH < 6 ? 'Q2' : CUR_MONTH < 9 ? 'Q3' : 'Q4';
const QUARTER_MONTHS = { Q1: [0,1,2], Q2: [3,4,5], Q3: [6,7,8], Q4: [9,10,11] };

function KpiCard({ label, value, sub, accent, borderColor }) {
  return (
    <div className="kpi-card" style={borderColor ? { borderTop: `4px solid ${borderColor}` } : accent ? { borderTop: '4px solid #FFD700' } : {}}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

/* ══════════════════════════════════════════
   JO/COS HOME DASHBOARD
══════════════════════════════════════════ */
function JOCOSHome({ user }) {
  const [indicators, setIndicators] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!user?.employeeId) { setLoading(false); return; }
      try {
        const [allInds, assigned, empLogs] = await Promise.all([
          getIndicators(true),
          getEmployeeIndicators(user.employeeId),
          getLogsForEmployee({ employeeId: user.employeeId, year: CUR_YEAR }),
        ]);
        const myInds = assigned.length > 0
          ? allInds.filter(i => assigned.includes(i.id))
          : allInds;
        setIndicators(myInds);
        setLogs(empLogs);
      } catch (err) {
        console.error('JO/COS home load error:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user]);

  // Compute tallies
  const loggedThisMonth = logs.filter(l => l.date?.startsWith(`${CUR_YEAR}-${CUR_MONTH_STR}`))
    .reduce((s, l) => s + (Number(l.value) || 0), 0);
  const qMonths = QUARTER_MONTHS[CUR_QUARTER];
  const loggedThisQuarter = logs.filter(l => {
    if (!l.date) return false;
    const m = parseInt(l.date.split('-')[1], 10) - 1;
    return qMonths.includes(m);
  }).reduce((s, l) => s + (Number(l.value) || 0), 0);
  const loggedThisYear = logs.reduce((s, l) => s + (Number(l.value) || 0), 0);

  // Functions active (unique functions with at least 1 log)
  const loggedIndIds = new Set(logs.map(l => l.indicatorId));
  const activeFunctions = new Set(
    indicators.filter(i => loggedIndIds.has(i.id)).map(i => i.functionName).filter(Boolean)
  ).size;

  // Recent entries (last 5)
  const recent = [...logs].reverse().slice(0, 5);

  return (
    <div className={styles.page}>
      {/* Welcome Banner */}
      <div className={styles.banner}>
        <div>
          <h2 className={styles.welcome}>
            Welcome, <span className={styles.name}>{user?.displayName || user?.email?.split('@')[0]}</span>
          </h2>
          <p className={styles.welcomeSub}>
            <span className={`badge badge-pending`} style={{ marginRight: 6, fontSize: '0.72rem' }}>📋 JO/COS</span>
            {CUR_QUARTER} {CUR_YEAR} — {MONTH_NAMES[CUR_MONTH]} reporting period active
          </p>
        </div>
        <div className={styles.periodBadge}>
          <span>{CUR_QUARTER}</span>
          <span>{CUR_YEAR}</span>
        </div>
      </div>

      {/* KPI row */}
      {loading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : (
        <>
          <h3 className={styles.sectionTitle}>📊 My Performance — {MONTH_NAMES[CUR_MONTH]} {CUR_YEAR}</h3>
          <div className="grid-4" style={{ marginBottom: 20 }}>
            <KpiCard label="Indicators Assigned" value={indicators.length} sub="Total performance indicators" />
            <KpiCard label={`Logged This Month`} value={loggedThisMonth} sub={MONTH_NAMES[CUR_MONTH]} borderColor="#198754" />
            <KpiCard label={`Logged — ${CUR_QUARTER}`} value={loggedThisQuarter} sub="Quarterly tally" accent />
            <KpiCard label="Active Functions" value={activeFunctions} sub="With at least 1 entry" borderColor="#0047b3" />
          </div>

          {/* Recent entries */}
          {recent.length > 0 && (
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-header">🕐 Recent Log Entries</div>
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr><th>Date</th><th>Indicator</th><th>Value</th><th>Notes</th></tr>
                  </thead>
                  <tbody>
                    {recent.map(l => {
                      const ind = indicators.find(i => i.id === l.indicatorId);
                      return (
                        <tr key={l.id}>
                          <td style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{l.date}</td>
                          <td style={{ fontSize: '0.82rem' }}>
                            <div style={{ fontWeight: 600 }}>{ind?.functionName || '—'}</div>
                            <div style={{ color: 'var(--color-text-muted)', fontSize: '0.76rem' }}>{ind?.indicatorDesc}</div>
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 700 }}>{l.value}</td>
                          <td style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>{l.notes || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Quick Actions */}
      <h3 className={styles.sectionTitle}>⚡ Quick Actions</h3>
      <div className={styles.actions}>
        <Link href="/tracker" className={styles.actionCard}>
          <span className={styles.actionIcon}>📊</span>
          <span className={styles.actionLabel}>Log Entry</span>
          <span className={styles.actionSub}>Record today's accomplishments</span>
        </Link>
        <Link href="/tracker?tab=history" className={styles.actionCard}>
          <span className={styles.actionIcon}>🗓️</span>
          <span className={styles.actionLabel}>Log History</span>
          <span className={styles.actionSub}>View all {CUR_QUARTER} entries</span>
        </Link>
        <Link href="/profile" className={styles.actionCard}>
          <span className={styles.actionIcon}>👤</span>
          <span className={styles.actionLabel}>My Profile</span>
          <span className={styles.actionSub}>Performance summary</span>
        </Link>
      </div>

      <p className={styles.notice}>
        📌 System Status: Online · Synced to CTTMO Firebase · {NOW.toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
      </p>
    </div>
  );
}

/* ══════════════════════════════════════════
   PLANTILLA / ADMIN HOME DASHBOARD
══════════════════════════════════════════ */
function PlantillaHome({ user }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    async function loadStats() {
      try {
        const [records, employees, mfos] = await Promise.all([
          getRecords({ year: CUR_YEAR }),
          getEmployees(),
          getMFOs(true),
        ]);
        const totalRecords = records.length;
        const accomplished = records.filter(r => r.status === 'Accomplished').length;
        const pending = records.filter(r => r.status === 'Pending').length;
        const deferred = records.filter(r => r.status === 'Deferred').length;
        const partial = records.filter(r => r.status === 'Partial').length;
        const rate = totalRecords > 0 ? Math.round((accomplished / totalRecords) * 100) : 0;
        const submittedEmpIds = new Set(
          records.filter(r => r.quarter === CUR_QUARTER).map(r => r.employeeId)
        );
        const pendingSubmissions = employees.filter(e => !submittedEmpIds.has(e.id)).length;
        setStats({ totalEmployees: employees.length, totalMFOs: mfos.length, totalRecords, accomplished, pending, deferred, partial, rate, pendingSubmissions });
      } catch (err) {
        console.error('Plantilla home load error:', err);
        setStats(null);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  return (
    <div className={styles.page}>
      <div className={styles.banner}>
        <div>
          <h2 className={styles.welcome}>
            Welcome, <span className={styles.name}>{user?.displayName || user?.email?.split('@')[0]}</span>
          </h2>
          <p className={styles.welcomeSub}>
            {isAdmin
              ? <><span className="badge badge-pending" style={{ marginRight: 6, fontSize: '0.72rem' }}>⚙️ ADMIN</span>Full system access</>
              : <><span className="badge badge-accomplished" style={{ marginRight: 6, fontSize: '0.72rem' }}>💼 PLANTILLA</span>{CUR_QUARTER} {CUR_YEAR} tracking active</>
            }
          </p>
        </div>
        <div className={styles.periodBadge}>
          <span>{CUR_QUARTER}</span>
          <span>{CUR_YEAR}</span>
        </div>
      </div>

      {loading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : stats ? (
        <>
          <h3 className={styles.sectionTitle}>📊 Division Overview — {CUR_YEAR}</h3>
          <div className="grid-4" style={{ marginBottom: 24 }}>
            <KpiCard label="Total Employees" value={stats.totalEmployees} sub="Active personnel" />
            <KpiCard label="Active MFOs" value={stats.totalMFOs} sub="Defined functions" />
            <KpiCard label="Accomplishment Rate" value={`${stats.rate}%`} sub={`${stats.accomplished} of ${stats.totalRecords} accomplished`} accent />
            <KpiCard label="Pending Submissions" value={stats.pendingSubmissions} sub={`Not yet filed ${CUR_QUARTER}`} borderColor="#dc3545" />
          </div>
          <div className="grid-4" style={{ marginBottom: 32 }}>
            {[
              { icon: '✅', val: stats.accomplished, label: 'Accomplished', status: 'accomplished' },
              { icon: '⚠️', val: stats.partial,     label: 'Partial',      status: 'partial' },
              { icon: '🔵', val: stats.pending,     label: 'Pending Review',status: 'pending' },
              { icon: '❌', val: stats.deferred,    label: 'Deferred',     status: 'deferred' },
            ].map(s => (
              <div key={s.status} className={styles.statCard} data-status={s.status}>
                <span className={styles.statIcon}>{s.icon}</span>
                <span className={styles.statVal}>{s.val}</span>
                <span className={styles.statLabel}>{s.label}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="alert alert-info" style={{ marginBottom: 24 }}>Unable to load statistics. Check your Firebase connection.</div>
      )}

      <h3 className={styles.sectionTitle}>⚡ Quick Actions</h3>
      <div className={styles.actions}>
        <Link href="/my-ipcr" className={styles.actionCard}>
          <span className={styles.actionIcon}>📝</span>
          <span className={styles.actionLabel}>Submit My IPCR</span>
          <span className={styles.actionSub}>Log {CUR_QUARTER} accomplishments</span>
        </Link>
        <Link href="/dashboard" className={styles.actionCard}>
          <span className={styles.actionIcon}>📈</span>
          <span className={styles.actionLabel}>View Analytics</span>
          <span className={styles.actionSub}>Charts, reports, leaderboard</span>
        </Link>
        <Link href="/profile" className={styles.actionCard}>
          <span className={styles.actionIcon}>👤</span>
          <span className={styles.actionLabel}>My Profile</span>
          <span className={styles.actionSub}>Submission history</span>
        </Link>
        {isAdmin && (
          <Link href="/admin" className={styles.actionCard}>
            <span className={styles.actionIcon}>⚙️</span>
            <span className={styles.actionLabel}>Admin Console</span>
            <span className={styles.actionSub}>{stats?.pendingSubmissions || 0} employees pending</span>
          </Link>
        )}
      </div>

      <p className={styles.notice}>
        📌 System Status: Online · All data synced to CTTMO Firebase · {NOW.toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
      </p>
    </div>
  );
}

/* ══════════════════════════════════════════
   PAGE ROUTER
══════════════════════════════════════════ */
export default function HomePage() {
  const { user } = useAuth();

  if (!user) return (
    <AppShell>
      <div className="loading-center"><div className="spinner" /></div>
    </AppShell>
  );

  const isJOCOS = user.role !== 'admin' && user.employmentType === 'jo_cos';

  return (
    <AppShell>
      {isJOCOS ? <JOCOSHome user={user} /> : <PlantillaHome user={user} />}
    </AppShell>
  );
}
