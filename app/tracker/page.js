'use client';
import { useState, useEffect, useCallback } from 'react';
import AppShell from '@/components/layout/AppShell';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { getIndicators, getEmployeeIndicators } from '@/lib/db/indicators';
import { logEntry, getLogsForEmployee, deleteEntry, computeMonthlyTallies } from '@/lib/db/indicatorLogs';
import { getEmployees } from '@/lib/db/employees';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, LineChart, Line, CartesianGrid } from 'recharts';
import styles from './page.module.css';

const MONTHS_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const CUR_YEAR = new Date().getFullYear();
const CUR_MONTH_IDX = new Date().getMonth(); // 0-indexed
const CUR_QUARTER = CUR_MONTH_IDX < 3 ? 'Q1' : CUR_MONTH_IDX < 6 ? 'Q2' : CUR_MONTH_IDX < 9 ? 'Q3' : 'Q4';
const QUARTER_MONTHS = { Q1: [0,1,2], Q2: [3,4,5], Q3: [6,7,8], Q4: [9,10,11] };

// Filter logs to the selected period
function filterLogsByPeriod(logs, mode, year, month, quarter) {
  return logs.filter(l => {
    if (!l.date) return false;
    const parts = l.date.split('-');
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1; // 0-indexed
    if (y !== year) return false;
    if (mode === 'monthly') return m === month;
    if (mode === 'quarterly') return QUARTER_MONTHS[quarter].includes(m);
    return true; // yearly — any month in this year
  });
}

function getPctColor(pct) {
  if (pct >= 80) return '#198754';
  if (pct >= 50) return '#c97a00';
  return '#dc3545';
}

function getStatus(pct) {
  if (pct >= 80) return { label: '✅ On Track', badge: 'badge-accomplished' };
  if (pct >= 50) return { label: '⚠️ At Risk', badge: 'badge-partial' };
  return { label: '❌ Below Target', badge: 'badge-deferred' };
}

/* ═══════════════ LOG ENTRY MODAL ═══════════════ */
function LogModal({ indicator, existingLogs, employeeId, year, onClose, onSaved }) {
  const today = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(today);
  const [value, setValue] = useState(1);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const tally = existingLogs.reduce((s, l) => s + (Number(l.value) || 0), 0);
  const target = Number(indicator.quarterlyTarget || indicator.annualTarget || 0);
  const pct = target > 0 ? Math.min(Math.round((tally / target) * 100), 100) : 0;

  async function handleSave(e) {
    e.preventDefault();
    if (!value || value <= 0) { setError('Value must be greater than 0'); return; }
    setSaving(true);
    try {
      await logEntry({ employeeId, indicatorId: indicator.id, date, value: Number(value), notes });
      onSaved();
      onClose();
    } catch (err) {
      setError('Failed to save: ' + err.message);
    } finally { setSaving(false); }
  }

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3 className="modal-title">📝 Log Performance Entry</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div style={{ background: '#fffce6', border: '2px solid var(--color-accent)', borderRadius: 8, padding: 12, marginBottom: 16 }}>
          <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>{indicator.functionName}</div>
          <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', marginTop: 4 }}>{indicator.indicatorDesc}</div>
          <div style={{ display: 'flex', gap: 20, marginTop: 10, fontSize: '0.82rem' }}>
            <span>Running Tally: <strong>{tally}</strong></span>
            <span>Target: <strong>{target}</strong></span>
            <span>Remaining: <strong>{Math.max(target - tally, 0)}</strong></span>
          </div>
          <div className="progress-bar" style={{ marginTop: 8 }}>
            <div className="progress-fill accomplished" style={{ width: `${pct}%`, background: getPctColor(pct) }} />
          </div>
          <div style={{ fontSize: '0.75rem', marginTop: 4, fontWeight: 700 }}>{pct}% of target</div>
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>}

        <form onSubmit={handleSave}>
          <div className="form-group">
            <label className="form-label">Date of Entry</label>
            <input type="date" className="form-control" value={date} onChange={e => setDate(e.target.value)} max={today} required />
          </div>

          <div className="form-group">
            <label className="form-label">Value Accomplished</label>
            <div className={styles.stepper}>
              <button type="button" className={styles.stepperBtn} onClick={() => setValue(v => Math.max(1, v - 1))}>−</button>
              <input
                type="number"
                className={styles.stepperInput}
                value={value}
                min={1}
                onChange={e => setValue(Number(e.target.value))}
                required
              />
              <button type="button" className={styles.stepperBtn} onClick={() => setValue(v => v + 1)}>+</button>
            </div>
            <div style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
              Unit: <strong>{indicator.unit || 'units'}</strong> &nbsp;|&nbsp; Direction: <strong>{indicator.direction === 'decrease' ? '↓ Decrease' : '↑ Increase'}</strong>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Notes / Remarks</label>
            <textarea className="form-control" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Describe the accomplishment..." rows={3} />
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving} style={{ flex: 2 }}>
              {saving ? 'Saving…' : '💾 Save Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ═══════════════ INDICATOR ROW ═══════════════ */
function IndicatorRow({ indicator, logs, onLog, onViewHistory }) {
  const tally = logs.reduce((s, l) => s + (Number(l.value) || 0), 0);

  return (
    <div className={styles.indicatorRow}>
      {/* Left: description + status */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className={styles.indicatorDesc}>{indicator.indicatorDesc}</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <span
            style={{
              display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
              background: tally > 0 ? '#198754' : '#adb5bd', flexShrink: 0,
            }}
          />
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
            {tally > 0 ? `${tally} logged this year` : 'No entries yet'}
          </span>
        </div>
      </div>

      {/* Right: tally + actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <div className={styles.tallyBox}>
          <div className={styles.tallyValue}>{tally}</div>
          <div className={styles.tallyLabel}>Tally</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <button className="btn btn-primary btn-sm" onClick={onLog}>+ Log</button>
          <button className="btn btn-outline btn-sm" onClick={onViewHistory}>History</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════ MAIN PAGE ═══════════════ */
export default function TrackerPage() {
  const { user } = useAuth();
  const router = useRouter();
  const isAdmin = user?.role === 'admin';

  const [tab, setTab] = useState('myIndicators');
  const [year, setYear] = useState(CUR_YEAR);
  const [empId, setEmpId] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [indicators, setIndicators] = useState([]);
  const [logs, setLogs] = useState([]);
  const [assignedIds, setAssignedIds] = useState([]);
  const [logging, setLogging] = useState(null);
  const [historyInd, setHistoryInd] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3000); }

  // Access guard: Plantilla employees belong on My IPCR, not Tracker
  useEffect(() => {
    if (user && !isAdmin && user.employmentType === 'plantilla') {
      router.replace('/my-ipcr');
    }
  }, [user, isAdmin, router]);

  // Setup employee context
  useEffect(() => {
    async function setup() {
      if (!user) return;
      if (isAdmin) {
        const emps = await getEmployees();
        setEmployees(emps);
        if (emps.length > 0) setEmpId(emps[0].id);
      } else {
        setEmpId(user.employeeId);
      }
    }
    setup();
  }, [user, isAdmin]);

  const loadData = useCallback(async () => {
    if (!empId) { setLoading(false); return; }
    setLoading(true);
    try {
      const [allInds, assigned, empLogs] = await Promise.all([
        getIndicators(true),
        getEmployeeIndicators(empId),
        getLogsForEmployee({ employeeId: empId, year }),
      ]);
      setAssignedIds(assigned);
      setIndicators(assigned.length > 0 ? allInds.filter(i => assigned.includes(i.id)) : allInds);
      setLogs(empLogs);
    } finally { setLoading(false); }
  }, [empId, year]);

  useEffect(() => { loadData(); }, [loadData]);

  const getLogsForIndicator = (indId) => logs.filter(l => l.indicatorId === indId);

  // Group a list of indicators by functionName
  function groupByFunction(inds) {
    const groups = [];
    const seen = {};
    for (const ind of inds) {
      const key = ind.functionName || '(No Function Listed)';
      if (!seen[key]) { seen[key] = []; groups.push({ key, items: seen[key] }); }
      seen[key].push(ind);
    }
    return groups;
  }

  // Period state
  const [mode, setMode] = useState('quarterly'); // 'monthly' | 'quarterly' | 'yearly'
  const [periodMonth, setPeriodMonth] = useState(CUR_MONTH_IDX);
  const [periodQuarter, setPeriodQuarter] = useState(CUR_QUARTER);

  // Accordion open state: Set of functionName keys that are expanded
  const [openGroups, setOpenGroups] = useState(new Set());
  function toggleGroup(key) {
    setOpenGroups(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  // Get logs filtered to the active period
  const periodLogs = filterLogsByPeriod(logs, mode, year, periodMonth, periodQuarter);
  const getLogsForIndicatorPeriod = (indId) => periodLogs.filter(l => l.indicatorId === indId);

  // Group all indicators by functionName for accordion
  function groupByFunction(inds) {
    const groups = [];
    const seen = {};
    for (const ind of inds) {
      const key = ind.functionName || '(No Function Listed)';
      if (!seen[key]) { seen[key] = []; groups.push({ key, items: seen[key] }); }
      seen[key].push(ind);
    }
    return groups;
  }
  const allGroups = groupByFunction(indicators);

  // Open all groups on first load
  useEffect(() => {
    if (allGroups.length > 0 && openGroups.size === 0) {
      setOpenGroups(new Set(allGroups.map(g => g.key)));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indicators]);

  // Chart data for Analytics tab
  const chartData = indicators.map(ind => {
    const indLogs = getLogsForIndicator(ind.id);
    const tally = indLogs.reduce((s, l) => s + Number(l.value || 0), 0);
    const target = Number(ind.quarterlyTarget || ind.annualTarget || 0);
    return {
      name: ind.functionName?.length > 20 ? ind.functionName.slice(0, 18) + '…' : ind.functionName,
      Tally: tally,
      Target: target,
    };
  });

  // Monthly trend for selected indicator (history view)
  const monthlyTrend = historyInd ? (() => {
    const indLogs = getLogsForIndicator(historyInd.id);
    const monthly = computeMonthlyTallies(indLogs);
    return MONTHS.map((m, i) => ({ month: m, Tally: monthly[i] }));
  })() : [];

  if (!empId && !isAdmin) {
    return (
      <AppShell>
        <div className="alert alert-error">Your account is not linked to an employee record. Please contact the administrator.</div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className={styles.page}>
        {toast && <div className="alert alert-success" style={{ position: 'fixed', top: 20, right: 20, zIndex: 999, minWidth: 240 }}>{toast}</div>}

        <div className={styles.topBar}>
          <div>
            <h2 className={styles.pageTitle}>📊 Performance Tracker</h2>
            <p className={styles.pageSub}>Log and track measurable performance indicators</p>
          </div>
          <div className={styles.filters}>
            {isAdmin && (
              <select className="form-control" value={empId || ''} onChange={e => setEmpId(e.target.value)}>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            )}
            <select className="form-control" value={year} onChange={e => setYear(Number(e.target.value))}>
              {[2024, 2025, 2026, 2027].map(y => <option key={y}>{y}</option>)}
            </select>
          </div>
        </div>

        {/* Period Mode Toggle */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', border: '1.5px solid var(--color-border)', borderRadius: 6, overflow: 'hidden' }}>
            {[['monthly','📅 Monthly'],['quarterly','📋 Quarterly'],['yearly','📆 Yearly']].map(([val, lbl]) => (
              <button
                key={val}
                onClick={() => setMode(val)}
                style={{
                  padding: '6px 14px', fontSize: '0.8rem', fontWeight: 700, border: 'none',
                  cursor: 'pointer', borderRight: '1.5px solid var(--color-border)',
                  background: mode === val ? 'var(--color-accent)' : '#fff',
                  color: '#000',
                }}
              >{lbl}</button>
            ))}
          </div>
          {mode === 'monthly' && (
            <select className="form-control" style={{ width: 'auto' }} value={periodMonth} onChange={e => setPeriodMonth(Number(e.target.value))}>
              {MONTHS_FULL.map((m, i) => <option key={i} value={i}>{m} {year}</option>)}
            </select>
          )}
          {mode === 'quarterly' && (
            <select className="form-control" style={{ width: 'auto' }} value={periodQuarter} onChange={e => setPeriodQuarter(e.target.value)}>
              {['Q1','Q2','Q3','Q4'].map(q => <option key={q}>{q} {year}</option>)}
            </select>
          )}
          {mode === 'yearly' && (
            <span style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Full Year {year}</span>
          )}
        </div>

        {/* Tabs */}
        <div className="tab-list">
          {[
            { key: 'myIndicators', label: '📋 My Indicators' },
            { key: 'history',      label: '🗓️ Log History' },
            { key: 'analytics',    label: '📈 Analytics' },
          ].map(t => (
            <button key={t.key} className={`tab-btn ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── MY INDICATORS TAB: Layout B Accordion ── */}
        {tab === 'myIndicators' && (
          <div className={styles.tabContent}>
            {loading ? (
              <div className="loading-center"><div className="spinner" /></div>
            ) : indicators.length === 0 ? (
              <div className="alert alert-info">No performance indicators assigned yet. Contact your administrator.</div>
            ) : (
              <div className={styles.accordion}>
                {allGroups.map(({ key, items }) => {
                  const isOpen = openGroups.has(key);
                  // Count how many indicators in this group have at least 1 log in the period
                  const loggedCount = items.filter(ind => getLogsForIndicatorPeriod(ind.id).length > 0).length;
                  const totalTally = items.reduce((s, ind) =>
                    s + getLogsForIndicatorPeriod(ind.id).reduce((ss, l) => ss + (Number(l.value) || 0), 0), 0
                  );
                  return (
                    <div key={key} className={styles.accordionItem}>
                      {/* Accordion Header */}
                      <button
                        className={styles.accordionHeader}
                        onClick={() => toggleGroup(key)}
                        aria-expanded={isOpen}
                      >
                        <span className={styles.accordionTitle}>{key}</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span className={styles.accordionBadge}>
                            {loggedCount}/{items.length} logged
                          </span>
                          {totalTally > 0 && (
                            <span className={styles.accordionTally}>Tally: <strong>{totalTally}</strong></span>
                          )}
                          <span className={styles.accordionChevron}>{isOpen ? '▲' : '▼'}</span>
                        </span>
                      </button>

                      {/* Accordion Body */}
                      {isOpen && (
                        <div className={styles.accordionBody}>
                          {items.map(ind => {
                            const indLogs = getLogsForIndicatorPeriod(ind.id);
                            const tally = indLogs.reduce((s, l) => s + (Number(l.value) || 0), 0);
                            const hasLogs = indLogs.length > 0;
                            return (
                              <div key={ind.id} className={styles.accordionRow}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div className={styles.rowDesc}>{ind.indicatorDesc}</div>
                                  <div style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'center' }}>
                                    <span
                                      style={{
                                        width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                                        background: hasLogs ? '#198754' : '#adb5bd',
                                        display: 'inline-block',
                                      }}
                                    />
                                    <span style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)' }}>
                                      {hasLogs ? `${tally} logged` : 'No entries yet'}
                                    </span>
                                  </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                  <div className={styles.miniTally}>
                                    <span className={styles.miniTallyValue}>{tally}</span>
                                    <span className={styles.miniTallyLabel}>tally</span>
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    <button className="btn btn-primary btn-sm" onClick={() => setLogging(ind)}>+ Log</button>
                                    <button className="btn btn-outline btn-sm" onClick={() => { setHistoryInd(ind); setTab('history'); }}>History</button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── HISTORY TAB ── */}
        {tab === 'history' && (
          <div className={styles.tabContent}>
            {/* Indicator filter */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <label className="form-label" style={{ margin: 0, whiteSpace: 'nowrap' }}>Filter by Indicator:</label>
              <select className="form-control" value={historyInd?.id || ''} onChange={e => {
                const found = indicators.find(i => i.id === e.target.value);
                setHistoryInd(found || null);
              }}>
                <option value="">All Indicators</option>
                {indicators.map(i => <option key={i.id} value={i.id}>{i.functionName}</option>)}
              </select>
            </div>

            {loading ? <div className="loading-center"><div className="spinner" /></div> : (() => {
              const displayLogs = historyInd
                ? logs.filter(l => l.indicatorId === historyInd.id)
                : logs;
              return (
                <div className="card">
                  <div className="card-header">
                    {historyInd ? `${historyInd.functionName} — Entries` : `All Entries`} ({displayLogs.length})
                  </div>
                  <div className="table-wrapper">
                    <table className="data-table">
                      <thead>
                        <tr><th>Date</th><th>Function</th><th>Value</th><th>Notes</th><th>Action</th></tr>
                      </thead>
                      <tbody>
                        {displayLogs.length === 0 ? (
                          <tr><td colSpan={5} style={{ textAlign: 'center', padding: 20 }}>No entries yet. Use "My Indicators" to log entries.</td></tr>
                        ) : [...displayLogs].reverse().map(l => {
                          const ind = indicators.find(i => i.id === l.indicatorId);
                          return (
                            <tr key={l.id}>
                              <td className={styles.dateCell}>{l.date}</td>
                              <td style={{ fontWeight: 600, maxWidth: 200, fontSize: '0.85rem' }}>{ind?.functionName || l.indicatorId}</td>
                              <td style={{ textAlign: 'center', fontWeight: 700 }}>
                                {l.value} <span style={{ fontSize: '0.75rem', fontWeight: 400 }}>{ind?.unit || ''}</span>
                              </td>
                              <td className={styles.notesCell}>{l.notes || '—'}</td>
                              <td>
                                <button className="btn btn-danger btn-sm" onClick={async () => {
                                  if (!confirm('Delete this entry?')) return;
                                  await deleteEntry(l.id);
                                  showToast('🗑️ Entry deleted');
                                  loadData();
                                }}>Delete</button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* ── ANALYTICS TAB ── */}
        {tab === 'analytics' && (
          <div className={styles.tabContent}>
            {/* KPI Cards */}
            <div className="grid-4">
              {(() => {
                const total = indicators.length;
                const onTrack = indicators.filter(ind => {
                  const tally = getLogsForIndicator(ind.id).reduce((s, l) => s + Number(l.value || 0), 0);
                  const t = Number(ind.quarterlyTarget || ind.annualTarget || 0);
                  return t > 0 && (tally / t) * 100 >= 80;
                }).length;
                const atRisk = indicators.filter(ind => {
                  const tally = getLogsForIndicator(ind.id).reduce((s, l) => s + Number(l.value || 0), 0);
                  const t = Number(ind.quarterlyTarget || ind.annualTarget || 0);
                  const pct = t > 0 ? (tally / t) * 100 : 0;
                  return pct >= 50 && pct < 80;
                }).length;
                const below = total - onTrack - atRisk;
                return (
                  <>
                    <div className="kpi-card"><div className="kpi-label">Total Indicators</div><div className="kpi-value">{total}</div></div>
                    <div className="kpi-card" style={{ borderTop: '4px solid #198754' }}><div className="kpi-label">On Track (≥80%)</div><div className="kpi-value">{onTrack}</div></div>
                    <div className="kpi-card" style={{ borderTop: '4px solid #c97a00' }}><div className="kpi-label">At Risk (50–79%)</div><div className="kpi-value">{atRisk}</div></div>
                    <div className="kpi-card" style={{ borderTop: '4px solid #dc3545' }}><div className="kpi-label">Below Target</div><div className="kpi-value">{below}</div></div>
                  </>
                );
              })()}
            </div>

            {/* Tally vs Target Chart */}
            {chartData.length > 0 && (
              <div className="card">
                <div className="card-header">📊 Tally vs Target</div>
                <div className="card-body">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 60 }}>
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-35} textAnchor="end" interval={0} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="Target" fill="#e0e0e0" radius={[4,4,0,0]} />
                      <Bar dataKey="Tally" fill="#FFD700" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Monthly trend (if an indicator is selected in history) */}
            {historyInd && (
              <div className="card">
                <div className="card-header">📈 Monthly Trend — {historyInd.functionName}</div>
                <div className="card-body">
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={monthlyTrend} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="Tally" stroke="#FFD700" strokeWidth={2} dot={{ r: 4, fill: '#000' }} />
                    </LineChart>
                  </ResponsiveContainer>
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 6 }}>
                    Select an indicator in the History tab to view its monthly trend here.
                  </p>
                </div>
              </div>
            )}

            {indicators.length === 0 && (
              <div className="alert alert-info">No indicators assigned. Ask your admin to assign performance indicators to your account.</div>
            )}
          </div>
        )}

        {/* Log Modal */}
        {logging && (
          <LogModal
            indicator={logging}
            existingLogs={getLogsForIndicator(logging.id)}
            employeeId={empId}
            year={year}
            onClose={() => setLogging(null)}
            onSaved={() => { showToast('✅ Entry logged!'); loadData(); }}
          />
        )}
      </div>
    </AppShell>
  );
}
