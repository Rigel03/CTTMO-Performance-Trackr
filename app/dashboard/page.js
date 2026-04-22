'use client';
import { useState, useEffect, useCallback } from 'react';
import AppShell from '@/components/layout/AppShell';
import { getRecords } from '@/lib/db/records';
import { getEmployees } from '@/lib/db/employees';
import { getMFOs } from '@/lib/db/mfos';
import { exportToExcel, exportToPDF } from '@/lib/export';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, PieChart, Pie, Cell
} from 'recharts';
import styles from './page.module.css';

const STATUS_COLORS = {
  'Accomplished': '#198754',
  'Partial':      '#c97a00',
  'Pending':      '#0047b3',
  'Deferred':     '#dc3545',
  'Not Started':  '#adb5bd',
};

const CUR_YEAR = new Date().getFullYear();

export default function DashboardPage() {
  const [tab, setTab] = useState('overview');
  const [year, setYear] = useState(CUR_YEAR);
  const [quarter, setQuarter] = useState('All');
  const [empFilter, setEmpFilter] = useState('All');
  const [records, setRecords] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [mfos, setMFOs] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [recs, emps, mfoList] = await Promise.all([
        getRecords({ year }),
        getEmployees(),
        getMFOs(true),
      ]);
      setRecords(recs);
      setEmployees(emps);
      setMFOs(mfoList);
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => { loadData(); }, [loadData]);

  // Filter records
  let filtered = records;
  if (quarter !== 'All') filtered = filtered.filter(r => r.quarter === quarter);
  if (empFilter !== 'All') filtered = filtered.filter(r => r.employeeId === empFilter);

  // KPIs
  const total = filtered.length;
  const accomplished = filtered.filter(r => r.status === 'Accomplished').length;
  const pending = filtered.filter(r => r.status === 'Pending').length;
  const deferred = filtered.filter(r => r.status === 'Deferred').length;
  const partial = filtered.filter(r => r.status === 'Partial').length;
  const rate = total > 0 ? Math.round((accomplished / total) * 100) : 0;

  // Bar chart: MFO vs achievement %
  const mfoChart = mfos.map(m => {
    const mfoRecs = filtered.filter(r => r.mfoId === m.id);
    const acc = mfoRecs.filter(r => r.status === 'Accomplished').length;
    const pct = mfoRecs.length > 0 ? Math.round((acc / mfoRecs.length) * 100) : 0;
    return { name: m.mfoName.slice(0, 20), value: pct };
  });

  // Line chart: Q trend
  const qTrend = ['Q1','Q2','Q3','Q4'].map(q => {
    const qRecs = records.filter(r => r.quarter === q);
    const acc = qRecs.filter(r => r.status === 'Accomplished').length;
    return { quarter: q, rate: qRecs.length > 0 ? Math.round((acc / qRecs.length) * 100) : 0, total: qRecs.length };
  });

  // Pie chart data
  const pieData = [
    { name: 'Accomplished', value: accomplished, color: STATUS_COLORS.Accomplished },
    { name: 'Partial',      value: partial,      color: STATUS_COLORS.Partial },
    { name: 'Pending',      value: pending,      color: STATUS_COLORS.Pending },
    { name: 'Deferred',     value: deferred,     color: STATUS_COLORS.Deferred },
  ].filter(d => d.value > 0);

  // Leaderboard
  const leaderboard = employees.map(emp => {
    const empRecs = filtered.filter(r => r.employeeId === emp.id);
    const acc = empRecs.filter(r => r.status === 'Accomplished').length;
    const pct = empRecs.length > 0 ? Math.round((acc / empRecs.length) * 100) : 0;
    return { ...emp, totalRecs: empRecs.length, accomplished: acc, rate: pct };
  }).sort((a, b) => b.rate - a.rate);

  // Gap analysis
  const submittedEmpIds = new Set(filtered.map(r => r.employeeId));
  const notSubmitted = employees.filter(e => !submittedEmpIds.has(e.id));
  const deferredRecs = filtered.filter(r => r.status === 'Deferred');

  // Data table with joined info
  const tableData = filtered.map(r => {
    const emp = employees.find(e => e.id === r.employeeId);
    const mfo = mfos.find(m => m.id === r.mfoId);
    return {
      Employee: emp?.name || r.employeeId,
      MFO: mfo?.mfoName || r.mfoId,
      Category: mfo?.category || '',
      Quarter: r.quarter,
      Target: r.targetQty || 0,
      M1: r.quantityM1 || 0,
      M2: r.quantityM2 || 0,
      M3: r.quantityM3 || 0,
      Total: r.totalQty || 0,
      Status: r.status || 'Not Started',
      Remarks: r.remarks || '',
    };
  });

  function handleExportXLSX() { exportToExcel(tableData, `IPCR_${year}_${quarter}`); }
  function handleExportPDF()  { exportToPDF(tableData, `IPCR Report — ${quarter} ${year}`, `IPCR_${year}_${quarter}`); }

  const TABS = ['overview', 'trends', 'leaderboard', 'gap', 'table'];
  const TAB_LABELS = {
    overview: '📊 Overview',
    trends: '📈 Trends',
    leaderboard: '🏆 Leaderboard',
    gap: '🔍 Gap Analysis',
    table: '📋 Data Table',
  };

  return (
    <AppShell>
      <div className={styles.page}>
        {/* Page Header + Filters */}
        <div className={styles.topBar}>
          <div>
            <h2 className={styles.pageTitle}>📊 Analytics Dashboard</h2>
            <p className={styles.pageSub}>Division-wide performance insights and reports</p>
          </div>
          <div className={styles.filters}>
            <select className="form-control" value={empFilter} onChange={e => setEmpFilter(e.target.value)}>
              <option value="All">All Employees</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
            <select className="form-control" value={quarter} onChange={e => setQuarter(e.target.value)}>
              {['All','Q1','Q2','Q3','Q4'].map(q => <option key={q}>{q}</option>)}
            </select>
            <select className="form-control" value={year} onChange={e => setYear(Number(e.target.value))}>
              {[2024,2025,2026,2027].map(y => <option key={y}>{y}</option>)}
            </select>
          </div>
        </div>

        {/* Sub Tabs */}
        <div className="tab-list">
          {TABS.map(t => (
            <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="loading-center"><div className="spinner" /></div>
        ) : (
          <>
            {/* ── OVERVIEW ── */}
            {tab === 'overview' && (
              <div className={styles.tabContent}>
                <div className="grid-4" style={{ marginBottom: 20 }}>
                  <div className="kpi-card"><div className="kpi-label">Total Records</div><div className="kpi-value">{total}</div></div>
                  <div className="kpi-card" style={{ borderTop: '4px solid #198754' }}><div className="kpi-label">Accomplishment Rate</div><div className="kpi-value">{rate}%</div><div className="kpi-sub">{accomplished} accomplished</div></div>
                  <div className="kpi-card" style={{ borderTop: '4px solid #0047b3' }}><div className="kpi-label">Pending Review</div><div className="kpi-value">{pending}</div></div>
                  <div className="kpi-card" style={{ borderTop: '4px solid #dc3545' }}><div className="kpi-label">Deferred</div><div className="kpi-value">{deferred}</div></div>
                </div>

                <div className="grid-2">
                  <div className="card">
                    <div className="card-header">Accomplishment Rate by MFO (%)</div>
                    <div className="card-body" style={{ height: 260 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={mfoChart} margin={{ left: -10 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                          <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                          <Tooltip formatter={(v) => `${v}%`} />
                          <Bar dataKey="value" fill="#FFD700" stroke="#e6c200" radius={[4,4,0,0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="card">
                    <div className="card-header">Status Distribution</div>
                    <div className="card-body" style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, flexWrap: 'wrap' }}>
                      <PieChart width={180} height={180}>
                        <Pie data={pieData} cx={85} cy={85} outerRadius={80} dataKey="value">
                          {pieData.map((entry, index) => (
                            <Cell key={index} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {pieData.map(d => (
                          <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                            <span style={{ width: 12, height: 12, borderRadius: 3, background: d.color, flexShrink: 0 }} />
                            <span>{d.name}: <strong>{d.value}</strong></span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── TRENDS ── */}
            {tab === 'trends' && (
              <div className={styles.tabContent}>
                <div className="card">
                  <div className="card-header">Quarter-over-Quarter Accomplishment Rate — {year}</div>
                  <div className="card-body" style={{ height: 320 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={qTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                        <XAxis dataKey="quarter" />
                        <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} />
                        <Tooltip formatter={(v, name) => name === 'rate' ? `${v}%` : v} />
                        <Legend />
                        <Line type="monotone" dataKey="rate" name="Accomplishment %" stroke="#000" strokeWidth={2.5} dot={{ fill: '#FFD700', r: 5 }} />
                        <Line type="monotone" dataKey="total" name="Total Records" stroke="#aaa" strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

            {/* ── LEADERBOARD ── */}
            {tab === 'leaderboard' && (
              <div className={styles.tabContent}>
                <div className="card">
                  <div className="card-header">🏆 Employee Performance Ranking — {quarter === 'All' ? 'All Quarters' : quarter} {year}</div>
                  <div className="card-body" style={{ padding: 0 }}>
                    <div className="table-wrapper">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Employee</th>
                            <th>Position</th>
                            <th>Records</th>
                            <th>Accomplished</th>
                            <th>Rate</th>
                            <th>Progress</th>
                          </tr>
                        </thead>
                        <tbody>
                          {leaderboard.map((emp, i) => (
                            <tr key={emp.id}>
                              <td style={{ fontWeight: 700, color: i < 3 ? '#c97a00' : undefined }}>
                                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i+1}`}
                              </td>
                              <td style={{ fontWeight: 600 }}>{emp.name}</td>
                              <td style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{emp.position || '—'}</td>
                              <td style={{ textAlign: 'center' }}>{emp.totalRecs}</td>
                              <td style={{ textAlign: 'center' }}>{emp.accomplished}</td>
                              <td style={{ textAlign: 'center', fontWeight: 700 }}>{emp.rate}%</td>
                              <td style={{ minWidth: 100 }}>
                                <div className="progress-bar">
                                  <div className={`progress-fill ${emp.rate >= 80 ? 'accomplished' : emp.rate >= 50 ? 'partial' : ''}`}
                                    style={{ width: `${emp.rate}%` }} />
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── GAP ANALYSIS ── */}
            {tab === 'gap' && (
              <div className={styles.tabContent}>
                <div className="grid-2">
                  <div className="card">
                    <div className="card-header" style={{ background: '#f8d7da', borderBottom: '1px solid #e4aaad' }}>
                      ⚠️ Employees Without Submissions ({notSubmitted.length})
                    </div>
                    <div className="card-body">
                      {notSubmitted.length === 0 ? (
                        <div className="alert alert-success">All employees have submitted entries.</div>
                      ) : notSubmitted.map(e => (
                        <div key={e.id} className={styles.gapItem}>
                          <strong>{e.name}</strong>
                          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{e.position || 'N/A'}</span>
                          <span className="badge badge-notstarted">No Submission</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="card">
                    <div className="card-header" style={{ background: '#fdd', borderBottom: '1px solid #e4aaad' }}>
                      ❌ Deferred Entries ({deferredRecs.length})
                    </div>
                    <div className="card-body">
                      {deferredRecs.length === 0 ? (
                        <div className="alert alert-success">No deferred entries.</div>
                      ) : deferredRecs.map(r => {
                        const emp = employees.find(e => e.id === r.employeeId);
                        const mfo = mfos.find(m => m.id === r.mfoId);
                        return (
                          <div key={r.id} className={styles.gapItem}>
                            <strong>{emp?.name || 'Unknown'}</strong>
                            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{mfo?.mfoName?.slice(0, 40) || 'Unknown MFO'}</span>
                            <span className="badge badge-deferred">{r.quarter}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── DATA TABLE ── */}
            {tab === 'table' && (
              <div className={styles.tabContent}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginBottom: 12 }}>
                  <button className="btn btn-outline btn-sm" onClick={handleExportXLSX}>📥 Export Excel</button>
                  <button className="btn btn-outline btn-sm" onClick={handleExportPDF}>📄 Export PDF</button>
                </div>
                <div className="card">
                  <div className="table-wrapper">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Employee</th>
                          <th>MFO</th>
                          <th>Category</th>
                          <th>Quarter</th>
                          <th>Target</th>
                          <th>M1</th>
                          <th>M2</th>
                          <th>M3</th>
                          <th>Total</th>
                          <th>Status</th>
                          <th>Remarks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tableData.length === 0 ? (
                          <tr><td colSpan={11} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>No records found</td></tr>
                        ) : tableData.map((row, i) => (
                          <tr key={i}>
                            <td style={{ fontWeight: 600 }}>{row.Employee}</td>
                            <td>{row.MFO}</td>
                            <td><span className={`badge badge-${row.Category === 'Core' ? 'pending' : 'notstarted'}`}>{row.Category}</span></td>
                            <td style={{ textAlign: 'center' }}>{row.Quarter}</td>
                            <td style={{ textAlign: 'center' }}>{row.Target}</td>
                            <td style={{ textAlign: 'center' }}>{row.M1}</td>
                            <td style={{ textAlign: 'center' }}>{row.M2}</td>
                            <td style={{ textAlign: 'center' }}>{row.M3}</td>
                            <td style={{ textAlign: 'center', fontWeight: 700 }}>{row.Total}</td>
                            <td>
                              <span className={`badge badge-${(row.Status||'').toLowerCase().replace(' ','')}`}>
                                {row.Status}
                              </span>
                            </td>
                            <td style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', maxWidth: 160 }}>{row.Remarks}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
