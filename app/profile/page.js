'use client';
import { useState, useEffect } from 'react';
import AppShell from '@/components/layout/AppShell';
import { useAuth } from '@/hooks/useAuth';
import { getRecords } from '@/lib/db/records';
import { getMFOs } from '@/lib/db/mfos';
import { getLogsForEmployee, computeMonthlyTallies } from '@/lib/db/indicatorLogs';
import { getIndicators, getEmployeeIndicators } from '@/lib/db/indicators';
import { logoutUser } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';

const CUR_YEAR = new Date().getFullYear();
const MONTHS_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const QUARTER_MONTHS = { Q1: [0,1,2], Q2: [3,4,5], Q3: [6,7,8], Q4: [9,10,11] };

const STATUS_BADGE = {
  'Accomplished': 'badge-accomplished',
  'Partial':      'badge-partial',
  'Pending':      'badge-pending',
  'Deferred':     'badge-deferred',
  'Not Started':  'badge-notstarted',
};

/* ══════════════════════════════════════════
   PLANTILLA PROFILE — MFO submission history
══════════════════════════════════════════ */
function PlantillaProfile({ user, year }) {
  const [records, setRecords] = useState([]);
  const [mfos, setMFOs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!user) return;
      setLoading(true);
      try {
        const empId = user.employeeId || user.uid;
        const [recs, mfoList] = await Promise.all([
          getRecords({ employeeId: empId, year }),
          getMFOs(true),
        ]);
        setRecords(recs);
        setMFOs(mfoList);
      } finally { setLoading(false); }
    }
    load();
  }, [user, year]);

  const accomplished = records.filter(r => r.status === 'Accomplished').length;
  const total = records.length;
  const rate = total > 0 ? Math.round((accomplished / total) * 100) : 0;
  const byQuarter = ['Q1','Q2','Q3','Q4'].map(q => ({
    quarter: q,
    records: records.filter(r => r.quarter === q),
  }));

  return (
    <>
      {/* Summary KPIs */}
      <div className="grid-3" style={{ marginBottom: 8 }}>
        <div className="kpi-card"><div className="kpi-label">Total Entries</div><div className="kpi-value">{total}</div></div>
        <div className="kpi-card" style={{ borderTop: '4px solid #198754' }}><div className="kpi-label">Accomplished</div><div className="kpi-value">{accomplished}</div></div>
        <div className="kpi-card" style={{ borderTop: '4px solid #FFD700' }}><div className="kpi-label">Completion Rate</div><div className="kpi-value">{rate}%</div></div>
      </div>

      {loading ? <div className="loading-center"><div className="spinner" /></div> : (
        byQuarter.map(({ quarter, records: qRecs }) => (
          <div key={quarter} className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{quarter} — {year}</span>
              <span style={{ fontSize: '0.8rem', fontWeight: 400 }}>{qRecs.length} entries</span>
            </div>
            {qRecs.length === 0 ? (
              <div className="card-body" style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                No entries submitted for {quarter}.
              </div>
            ) : (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>MFO</th><th>Target</th>
                      <th>M1</th><th>M2</th><th>M3</th>
                      <th>Total</th><th>Status</th><th>Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {qRecs.map(r => {
                      const mfo = mfos.find(m => m.id === r.mfoId);
                      return (
                        <tr key={r.id}>
                          <td style={{ fontWeight: 600, maxWidth: 220 }}>{mfo?.mfoName || r.mfoId}</td>
                          <td style={{ textAlign: 'center' }}>{r.targetQty || 0}</td>
                          <td style={{ textAlign: 'center' }}>{r.quantityM1 || 0}</td>
                          <td style={{ textAlign: 'center' }}>{r.quantityM2 || 0}</td>
                          <td style={{ textAlign: 'center' }}>{r.quantityM3 || 0}</td>
                          <td style={{ textAlign: 'center', fontWeight: 700 }}>{r.totalQty || 0}</td>
                          <td><span className={`badge ${STATUS_BADGE[r.status] || 'badge-notstarted'}`}>{r.status}</span></td>
                          <td style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', maxWidth: 180 }}>{r.remarks || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))
      )}
    </>
  );
}

/* ══════════════════════════════════════════
   JO/COS PROFILE — PI log history
══════════════════════════════════════════ */
function JOCOSProfile({ user, year }) {
  const [indicators, setIndicators] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewQuarter, setViewQuarter] = useState('All');

  useEffect(() => {
    async function load() {
      if (!user?.employeeId) { setLoading(false); return; }
      setLoading(true);
      try {
        const [allInds, assigned, empLogs] = await Promise.all([
          getIndicators(true),
          getEmployeeIndicators(user.employeeId),
          getLogsForEmployee({ employeeId: user.employeeId, year }),
        ]);
        const myInds = assigned.length > 0 ? allInds.filter(i => assigned.includes(i.id)) : allInds;
        setIndicators(myInds);
        setLogs(empLogs);
      } finally { setLoading(false); }
    }
    load();
  }, [user, year]);

  // Monthly tally (all indicators combined)
  const monthlyTotals = computeMonthlyTallies(logs);

  // Per-quarter tally
  const quarterTotals = { Q1: 0, Q2: 0, Q3: 0, Q4: 0 };
  for (const l of logs) {
    if (!l.date) continue;
    const m = parseInt(l.date.split('-')[1], 10) - 1;
    const q = m < 3 ? 'Q1' : m < 6 ? 'Q2' : m < 9 ? 'Q3' : 'Q4';
    quarterTotals[q] += Number(l.value) || 0;
  }
  const totalLogged = logs.reduce((s, l) => s + (Number(l.value) || 0), 0);

  // Filter logs by selected quarter
  const displayLogs = viewQuarter === 'All' ? logs : logs.filter(l => {
    if (!l.date) return false;
    const m = parseInt(l.date.split('-')[1], 10) - 1;
    return QUARTER_MONTHS[viewQuarter].includes(m);
  });
  const displayReversed = [...displayLogs].reverse();

  return (
    <>
      {/* KPI row */}
      <div className="grid-4" style={{ marginBottom: 8 }}>
        <div className="kpi-card"><div className="kpi-label">Indicators Assigned</div><div className="kpi-value">{indicators.length}</div></div>
        <div className="kpi-card" style={{ borderTop: '4px solid #198754' }}><div className="kpi-label">Total Logged ({year})</div><div className="kpi-value">{totalLogged}</div></div>
        <div className="kpi-card" style={{ borderTop: '4px solid #FFD700' }}><div className="kpi-label">Log Entries</div><div className="kpi-value">{logs.length}</div></div>
        <div className="kpi-card" style={{ borderTop: '4px solid #0047b3' }}><div className="kpi-label">Active Functions</div><div className="kpi-value">{new Set(indicators.map(i => i.functionName).filter(Boolean)).size}</div></div>
      </div>

      {/* Monthly breakdown */}
      <div className="card">
        <div className="card-header">📅 Monthly Log Totals — {year}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 1, padding: '12px 16px' }}>
          {MONTHS_FULL.slice(0, 12).map((m, i) => (
            <div key={m} style={{ textAlign: 'center', padding: '6px 4px', background: monthlyTotals[i] > 0 ? '#fffce6' : '#fafafa', borderRadius: 4, border: '1px solid var(--color-border)' }}>
              <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>{m.slice(0, 3)}</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 900, color: monthlyTotals[i] > 0 ? '#000' : '#ccc' }}>{monthlyTotals[i]}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Quarterly summary */}
      <div className="grid-4">
        {['Q1','Q2','Q3','Q4'].map(q => (
          <div key={q} className="kpi-card" style={{ borderTop: '3px solid var(--color-accent)', cursor: 'pointer', outline: viewQuarter === q ? '2px solid #000' : 'none' }}
            onClick={() => setViewQuarter(viewQuarter === q ? 'All' : q)}>
            <div className="kpi-label">{q} Tally</div>
            <div className="kpi-value">{quarterTotals[q]}</div>
            <div className="kpi-sub" style={{ fontSize: '0.7rem' }}>{viewQuarter === q ? '▶ Filtered' : 'Click to filter'}</div>
          </div>
        ))}
      </div>

      {/* Log history table */}
      {loading ? <div className="loading-center"><div className="spinner" /></div> : (
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>📋 Log History — {viewQuarter === 'All' ? `All of ${year}` : `${viewQuarter} ${year}`}</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className={`btn btn-sm ${viewQuarter === 'All' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setViewQuarter('All')}>All</button>
              {['Q1','Q2','Q3','Q4'].map(q => (
                <button key={q} className={`btn btn-sm ${viewQuarter === q ? 'btn-primary' : 'btn-outline'}`} onClick={() => setViewQuarter(q)}>{q}</button>
              ))}
            </div>
          </div>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr><th>Date</th><th>Function</th><th>Indicator</th><th>Value</th><th>Notes</th></tr>
              </thead>
              <tbody>
                {displayReversed.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: 20, color: 'var(--color-text-muted)' }}>No entries for this period.</td></tr>
                ) : displayReversed.map(l => {
                  const ind = indicators.find(i => i.id === l.indicatorId);
                  return (
                    <tr key={l.id}>
                      <td style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{l.date}</td>
                      <td style={{ fontSize: '0.82rem', fontWeight: 600, maxWidth: 160 }}>{ind?.functionName || '—'}</td>
                      <td style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', maxWidth: 240 }}>{ind?.indicatorDesc || l.indicatorId}</td>
                      <td style={{ textAlign: 'center', fontWeight: 700 }}>{l.value}</td>
                      <td style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', maxWidth: 200 }}>{l.notes || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

/* ══════════════════════════════════════════
   PROFILE PAGE
══════════════════════════════════════════ */
export default function ProfilePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [year, setYear] = useState(CUR_YEAR);

  const isJOCOS = user?.role !== 'admin' && user?.employmentType === 'jo_cos';

  async function handleLogout() {
    await logoutUser();
    router.push('/login');
  }

  const empTypeBadge = isJOCOS
    ? { cls: 'badge-pending', label: '📋 JO/COS' }
    : user?.role === 'admin'
      ? { cls: 'badge-pending', label: '⚙️ Admin' }
      : { cls: 'badge-accomplished', label: '💼 Plantilla' };

  return (
    <AppShell>
      <div className={styles.page}>
        {/* Profile Card */}
        <div className={styles.profileCard}>
          <div className={styles.avatar}>
            {(user?.displayName || user?.email || '?')[0].toUpperCase()}
          </div>
          <div className={styles.info}>
            <h2 className={styles.name}>{user?.displayName || user?.email?.split('@')[0]}</h2>
            <p className={styles.email}>{user?.email}</p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
              <span className={`badge ${empTypeBadge.cls}`}>{empTypeBadge.label}</span>
              <span className={`badge ${user?.role === 'admin' ? 'badge-pending' : 'badge-notstarted'}`}>
                {user?.role?.toUpperCase()}
              </span>
            </div>
          </div>
          <button className="btn btn-outline btn-sm" onClick={handleLogout} style={{ marginLeft: 'auto' }}>
            Sign Out
          </button>
        </div>

        {/* Year Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>
            {isJOCOS ? 'Performance Log History —' : 'Submission History —'}
          </h3>
          <select className="form-control" value={year} onChange={e => setYear(Number(e.target.value))} style={{ width: 100 }}>
            {[2024, 2025, 2026, 2027].map(y => <option key={y}>{y}</option>)}
          </select>
        </div>

        {/* Type-aware content */}
        {isJOCOS
          ? <JOCOSProfile user={user} year={year} />
          : <PlantillaProfile user={user} year={year} />
        }
      </div>
    </AppShell>
  );
}
