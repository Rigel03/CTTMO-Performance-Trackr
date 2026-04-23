'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import { useAuth } from '@/hooks/useAuth';
import { getMFOs } from '@/lib/db/mfos';
import { getRecords, saveRecord } from '@/lib/db/records';
import { getEmployees } from '@/lib/db/employees';
import { getEmployeeMFOs } from '@/lib/db/assignments';
import styles from './page.module.css';

const STATUS_CONFIG = {
  'Accomplished': { dot: '#198754', badge: 'badge-accomplished', label: '✅ Accomplished' },
  'Partial':      { dot: '#c97a00', badge: 'badge-partial',      label: '⚠️ Partial' },
  'Deferred':     { dot: '#dc3545', badge: 'badge-deferred',     label: '❌ Deferred' },
  'Pending':      { dot: '#0047b3', badge: 'badge-pending',      label: '🔵 Pending' },
  'Not Started':  { dot: '#adb5bd', badge: 'badge-notstarted',   label: '⚪ Not Started' },
};

const QUARTER_MONTHS = {
  Q1: ['January', 'February', 'March'],
  Q2: ['April', 'May', 'June'],
  Q3: ['July', 'August', 'September'],
  Q4: ['October', 'November', 'December'],
};

const CUR_YEAR = new Date().getFullYear();

// Compact horizontal row card for a single MFO
function MFORow({ mfo, record, onEdit }) {
  const status = record?.status || 'Not Started';
  const conf = STATUS_CONFIG[status] || STATUS_CONFIG['Not Started'];

  return (
    <div className={styles.mfoRow} onClick={() => onEdit(mfo, record)}>
      <div className={styles.rowLeft}>
        <span className={`badge ${conf.badge}`} style={{ fontSize: '0.7rem', whiteSpace: 'nowrap' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: conf.dot, display: 'inline-block', marginRight: 4 }} />
          {status}
        </span>
        <span className={styles.rowDesc}>{mfo.successIndicatorDesc}</span>
      </div>
      <button className={styles.rowBtn}>Update ›</button>
    </div>
  );
}

function EntryModal({ mfo, record, months, empId, mfoId, quarter, year, onClose, onSaved }) {
  const [targetQty, setTargetQty] = useState(record?.targetQty || 0);
  const [m1, setM1] = useState(record?.quantityM1 || 0);
  const [m2, setM2] = useState(record?.quantityM2 || 0);
  const [m3, setM3] = useState(record?.quantityM3 || 0);
  const [remarks, setRemarks] = useState(record?.remarks || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const total = m1 + m2 + m3;

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await saveRecord(empId, mfoId, quarter, year, {
        targetQty,
        quantityM1: m1,
        quantityM2: m2,
        quantityM3: m3,
        totalQty: total,
        remarks,
        status: record?.status === 'Not Started' || !record?.status ? 'Pending' : record.status,
      });
      onSaved();
      onClose();
    } catch (err) {
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3 className="modal-title">Update Entry</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className={styles.modalMfo}>
          <span className={styles.modalMfoName}>{mfo.mfoName}</span>
          <p className={styles.modalIndicator}>{mfo.successIndicatorDesc}</p>
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>}

        <form onSubmit={handleSave}>
          <div className="grid-2" style={{ marginBottom: 16 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Target Qty (Quarter)</label>
              <input type="number" className="form-control" min={0} value={targetQty}
                onChange={e => setTargetQty(Number(e.target.value))} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Total Achieved</label>
              <input type="number" className="form-control" value={total} disabled style={{ background: '#fffce6', fontWeight: 700 }} />
            </div>
          </div>

          <div style={{ marginBottom: 6, fontWeight: 700, fontSize: '0.85rem' }}>Monthly Accomplishments</div>
          <div className="grid-3" style={{ marginBottom: 16 }}>
            {[months[0], months[1], months[2]].map((month, i) => {
              const val = [m1, m2, m3][i];
              const setter = [setM1, setM2, setM3][i];
              return (
                <div key={month} className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">{month}</label>
                  <input type="number" className="form-control" min={0} value={val}
                    onChange={e => setter(Number(e.target.value))} />
                </div>
              );
            })}
          </div>

          <div className="form-group">
            <label className="form-label">Remarks / Notes</label>
            <textarea className="form-control" value={remarks} onChange={e => setRemarks(e.target.value)}
              placeholder="Optional notes on your accomplishments..." />
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
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

export default function MyIPCRPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [year, setYear] = useState(CUR_YEAR);
  const [quarter, setQuarter] = useState('Q1');
  const [mfos, setMFOs] = useState([]);
  const [records, setRecords] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [assignedMFOIds, setAssignedMFOIds] = useState(null);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [empId, setEmpId] = useState(null);

  const isAdmin = user?.role === 'admin';
  const months = QUARTER_MONTHS[quarter];

  // Access guard: JO/COS employees shouldn't access My IPCR
  useEffect(() => {
    if (user && !isAdmin && user.employmentType === 'jo_cos') {
      router.replace('/tracker');
    }
  }, [user, isAdmin, router]);

  const loadData = useCallback(async () => {
    if (!empId) { setLoading(false); return; }
    setLoading(true);
    try {
      const [mfoData, recData, assignedIds] = await Promise.all([
        getMFOs(true),
        getRecords({ employeeId: empId, year, quarter }),
        getEmployeeMFOs(empId),
      ]);
      setMFOs(mfoData);
      setRecords(recData);
      setAssignedMFOIds(assignedIds && assignedIds.length > 0 ? assignedIds : null);
    } finally {
      setLoading(false);
    }
  }, [empId, year, quarter]);

  useEffect(() => {
    async function setup() {
      if (!user) return;
      if (isAdmin) {
        const emps = await getEmployees('plantilla');
        setEmployees(emps);
        if (emps.length > 0) setEmpId(emps[0].id);
      } else {
        setEmpId(user.employeeId);
      }
    }
    setup();
  }, [user, isAdmin]);

  useEffect(() => { loadData(); }, [loadData]);

  const getRecord = (mfoId) => records.find(r => r.mfoId === mfoId);
  const visibleMFOs = mfos.filter(m => !assignedMFOIds || assignedMFOIds.includes(m.id));

  // Group by MFO name
  const groups = {};
  for (const mfo of visibleMFOs) {
    const key = mfo.mfoName || 'Uncategorized';
    if (!groups[key]) groups[key] = { mfoName: key, category: mfo.category, items: [] };
    groups[key].items.push(mfo);
  }
  const coreFunctions  = Object.values(groups).filter(g => g.category === 'Core');
  const supportFunctions = Object.values(groups).filter(g => g.category === 'Support');

  if (!empId && !isAdmin) {
    return (
      <AppShell>
        <div className="alert alert-error">
          Your account is not linked to an employee record. Please contact the administrator.
        </div>
      </AppShell>
    );
  }

  const FunctionSection = ({ groups, label }) => {
    if (groups.length === 0) return null;
    return (
      <div className={styles.section}>
        <div className={styles.sectionLabel}>{label}</div>
        {groups.map(group => (
          <div key={group.mfoName} className={styles.functionCard}>
            <div className={styles.functionHeader}>{group.mfoName}</div>
            <div className={styles.indicatorList}>
              {group.items.map(mfo => (
                <MFORow
                  key={mfo.id}
                  mfo={mfo}
                  record={getRecord(mfo.id)}
                  onEdit={(m, r) => setEditing({ mfo: m, record: r })}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <AppShell>
      <div className={styles.page}>
        {/* Header / Filters */}
        <div className={styles.topBar}>
          <div>
            <h2 className={styles.pageTitle}>📝 My IPCR Entry</h2>
            <p className={styles.pageSub}>Log your quarterly accomplishments per function</p>
          </div>
          <div className={styles.filters}>
            {isAdmin && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>Plantilla Employees:</span>
                <select className="form-control" value={empId || ''} onChange={e => setEmpId(e.target.value)}
                  style={{ minWidth: 160 }}>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
            )}
            <select className="form-control" value={quarter} onChange={e => setQuarter(e.target.value)}>
              {['Q1','Q2','Q3','Q4'].map(q => <option key={q}>{q}</option>)}
            </select>
            <select className="form-control" value={year} onChange={e => setYear(Number(e.target.value))}>
              {[2024,2025,2026,2027].map(y => <option key={y}>{y}</option>)}
            </select>
          </div>
        </div>

        {/* MFO Groups */}
        {loading ? (
          <div className="loading-center"><div className="spinner" /></div>
        ) : visibleMFOs.length === 0 ? (
          <div className="alert alert-info">No MFOs assigned. Contact your administrator.</div>
        ) : (
          <>
            <FunctionSection groups={coreFunctions} label="⚡ Core Functions" />
            <FunctionSection groups={supportFunctions} label="🛠️ Support Functions" />
          </>
        )}

        {/* Entry Modal */}
        {editing && (
          <EntryModal
            mfo={editing.mfo}
            record={editing.record}
            months={months}
            empId={empId}
            mfoId={editing.mfo.id}
            quarter={quarter}
            year={year}
            onClose={() => setEditing(null)}
            onSaved={loadData}
          />
        )}
      </div>
    </AppShell>
  );
}
