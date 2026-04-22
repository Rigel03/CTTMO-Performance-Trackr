'use client';
import { useState, useEffect, useCallback } from 'react';
import AppShell from '@/components/layout/AppShell';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { getEmployees, addEmployee, updateEmployee, deleteEmployee } from '@/lib/db/employees';
import { getMFOs, addMFO, updateMFO, toggleMFO, deleteMFO } from '@/lib/db/mfos';
import { getAllUsers, createUser, updateUserProfile, deleteUserProfile } from '@/lib/db/users';
import { getRecords, updateRecordStatus } from '@/lib/db/records';
import { setEmployeeMFOs, getEmployeeMFOs } from '@/lib/db/assignments';
import { getIndicators, addIndicator, updateIndicator, toggleIndicator, deleteIndicator, setEmployeeIndicators, getEmployeeIndicators } from '@/lib/db/indicators';
import styles from './page.module.css';

const STATUS_OPTIONS = ['Pending', 'Accomplished', 'Partial', 'Deferred'];

export default function AdminPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState('employees');

  // Check admin access
  useEffect(() => {
    if (user && user.role !== 'admin') router.replace('/home');
  }, [user, router]);

  if (!user || user.role !== 'admin') return null;

  const TABS = [
    { key: 'employees',   label: '👥 Employees' },
    { key: 'assign',      label: '📌 MFO Assignments' },
    { key: 'pi',          label: '📊 PI Definitions' },
    { key: 'pi_assign',   label: '🔗 PI Assignments' },
    { key: 'mfos',        label: '📋 MFO Definitions' },
    { key: 'users',       label: '🔐 User Accounts' },
    { key: 'import',      label: '📤 Bulk Import' },
    { key: 'review',      label: '📝 Review Submissions' },
  ];

  return (
    <AppShell>
      <div className={styles.page}>
        <div className={styles.topBar}>
          <h2 className={styles.pageTitle}>⚙️ Admin Console</h2>
          <p className={styles.pageSub}>System management — restricted to administrators</p>
        </div>

        <div className="tab-list">
          {TABS.map(t => (
            <button key={t.key} className={`tab-btn ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'employees' && <EmployeesTab />}
        {tab === 'assign'    && <AssignmentsTab />}
        {tab === 'pi'        && <PerformanceIndicatorsTab />}
        {tab === 'pi_assign' && <PIAssignmentsTab />}
        {tab === 'mfos'      && <MFOsTab />}
        {tab === 'users'     && <UsersTab />}
        {tab === 'import'    && <ImportTab />}
        {tab === 'review'    && <ReviewTab />}
      </div>
    </AppShell>
  );
}

/* ══════ EMPLOYEES TAB (unified, all types) ══════ */
function EmployeesTab() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editEmp, setEditEmp] = useState(null);
  const [form, setForm] = useState({ name: '', position: '', section: '', employmentType: 'plantilla' });
  const [toast, setToast] = useState('');
  const [typeFilter, setTypeFilter] = useState('all'); // 'all' | 'plantilla' | 'jo_cos'

  const load = useCallback(async () => {
    setLoading(true);
    setEmployees(await getEmployees());
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3000); }

  async function handleAdd(e) {
    e.preventDefault();
    await addEmployee({ ...form });
    showToast('✅ Employee added');
    setForm({ name: '', position: '', section: '', employmentType: 'plantilla' });
    setShowAdd(false);
    load();
  }

  async function handleUpdate(e) {
    e.preventDefault();
    await updateEmployee(editEmp.id, {
      name: editEmp.name,
      position: editEmp.position || '',
      section: editEmp.section || editEmp.division || '',
      employmentType: editEmp.employmentType || 'plantilla',
    });
    showToast('✅ Updated');
    setEditEmp(null);
    load();
  }

  async function handleDelete(id) {
    if (!confirm('Delete this record? This cannot be undone.')) return;
    await deleteEmployee(id);
    showToast('🗑️ Deleted');
    load();
  }

  async function handleToggleType(emp) {
    const next = emp.employmentType === 'jo_cos' ? 'plantilla' : 'jo_cos';
    await updateEmployee(emp.id, { employmentType: next });
    showToast(`✅ ${emp.name} changed to ${next === 'plantilla' ? 'Plantilla' : 'JO/COS'}`);
    load();
  }

  const filtered = typeFilter === 'all' ? employees : employees.filter(e => e.employmentType === typeFilter);

  const TypeBadge = ({ type }) => (
    <span className={`badge ${type === 'plantilla' ? 'badge-accomplished' : 'badge-pending'}`}
      style={{ fontSize: '0.72rem', letterSpacing: '0.03em' }}>
      {type === 'plantilla' ? '💼 Plantilla' : '📋 JO/COS'}
    </span>
  );

  return (
    <div className={styles.tabContent}>
      {toast && <div className="alert alert-success" style={{ position: 'fixed', top: 20, right: 20, zIndex: 999, minWidth: 240 }}>{toast}</div>}

      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 4 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {[['all','All Employees'],['plantilla','💼 Plantilla'],['jo_cos','📋 JO/COS']].map(([val, lbl]) => (
            <button key={val} className={`btn btn-sm ${typeFilter === val ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTypeFilter(val)}>{lbl}</button>
          ))}
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? 'Cancel' : '➕ Add Employee'}
        </button>
      </div>

      <div className="alert alert-info" style={{ marginBottom: 10, fontSize: '0.82rem' }}>
        <strong>Classification:</strong>&nbsp;
        <TypeBadge type="plantilla" /> Regular government employees (MFO-based tracking)&nbsp;&nbsp;
        <TypeBadge type="jo_cos" /> Job Order / Contract of Service (PI-based tracking)
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className={styles.inlineForm}>
          <div className="grid-2" style={{ marginBottom: 12 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Full Name *</label>
              <input className="form-control" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Juan Dela Cruz" />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Employee Type *</label>
              <select className="form-control" value={form.employmentType} onChange={e => setForm(f => ({ ...f, employmentType: e.target.value }))}>
                <option value="plantilla">💼 Plantilla</option>
                <option value="jo_cos">📋 Job Order / COS</option>
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Position / Designation</label>
              <input className="form-control" value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))} placeholder="Planning Officer I" />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Section / Unit</label>
              <input className="form-control" value={form.section} onChange={e => setForm(f => ({ ...f, section: e.target.value }))} placeholder="Transport Planning" />
            </div>
          </div>
          <button type="submit" className="btn btn-primary">Save Employee</button>
        </form>
      )}

      {loading ? <div className="loading-center"><div className="spinner" /></div> : (
        <div className="card">
          <div className="card-header">All Employees — {filtered.length} record{filtered.length !== 1 ? 's' : ''}</div>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr><th>#</th><th>Name</th><th>Type</th><th>Position</th><th>Section / Unit</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-muted)' }}>No employees found.</td></tr>
                ) : filtered.map((emp, i) => (
                  editEmp?.id === emp.id ? (
                    <tr key={emp.id}>
                      <td>{i + 1}</td>
                      <td><input className="form-control" value={editEmp.name} onChange={e => setEditEmp(v => ({ ...v, name: e.target.value }))} /></td>
                      <td>
                        <select className="form-control" value={editEmp.employmentType || 'plantilla'} onChange={e => setEditEmp(v => ({ ...v, employmentType: e.target.value }))}>
                          <option value="plantilla">💼 Plantilla</option>
                          <option value="jo_cos">📋 JO/COS</option>
                        </select>
                      </td>
                      <td><input className="form-control" value={editEmp.position || ''} onChange={e => setEditEmp(v => ({ ...v, position: e.target.value }))} /></td>
                      <td><input className="form-control" value={editEmp.section || editEmp.division || ''} onChange={e => setEditEmp(v => ({ ...v, section: e.target.value }))} /></td>
                      <td style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-primary btn-sm" onClick={handleUpdate}>Save</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setEditEmp(null)}>Cancel</button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={emp.id}>
                      <td>{i + 1}</td>
                      <td style={{ fontWeight: 600 }}>{emp.name}</td>
                      <td><TypeBadge type={emp.employmentType || 'plantilla'} /></td>
                      <td>{emp.position || '—'}</td>
                      <td>{emp.section || emp.division || '—'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                          <button className="btn btn-outline btn-sm" onClick={() => setEditEmp(emp)}>Edit</button>
                          <button
                            className="btn btn-outline btn-sm"
                            title={emp.employmentType === 'jo_cos' ? 'Change to Plantilla' : 'Change to JO/COS'}
                            onClick={() => handleToggleType(emp)}
                          >
                            {emp.employmentType === 'jo_cos' ? '→ Plantilla' : '→ JO/COS'}
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(emp.id)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  )
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════ MFOs TAB ══════ */
function MFOsTab() {
  const [mfos, setMFOs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editMFO, setEditMFO] = useState(null);
  const [form, setForm] = useState({ category: 'Core', mfoName: '', successIndicatorDesc: '' });
  const [toast, setToast] = useState('');

  const load = useCallback(async () => { setLoading(true); setMFOs(await getMFOs()); setLoading(false); }, []);
  useEffect(() => { load(); }, [load]);
  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3000); }

  async function handleAdd(e) {
    e.preventDefault();
    await addMFO(form);
    showToast('✅ MFO added');
    setForm({ category: 'Core', mfoName: '', successIndicatorDesc: '' });
    setShowAdd(false);
    load();
  }

  async function handleUpdate(e) {
    e.preventDefault();
    await updateMFO(editMFO.id, { category: editMFO.category, mfoName: editMFO.mfoName, successIndicatorDesc: editMFO.successIndicatorDesc });
    showToast('✅ MFO updated');
    setEditMFO(null);
    load();
  }

  async function handleToggle(id, current) {
    await toggleMFO(id, current);
    showToast(`MFO ${current ? 'deactivated' : 'activated'}`);
    load();
  }

  async function handleDelete(id) {
    if (!confirm('Delete this MFO and all its records? Cannot be undone.')) return;
    await deleteMFO(id);
    showToast('🗑️ MFO deleted');
    load();
  }

  return (
    <div className={styles.tabContent}>
      {toast && <div className="alert alert-success" style={{ position: 'fixed', top: 20, right: 20, zIndex: 999, minWidth: 240 }}>{toast}</div>}
      <button className="btn btn-primary" onClick={() => setShowAdd(!showAdd)}>{showAdd ? 'Cancel' : '➕ Add MFO'}</button>

      {showAdd && (
        <form onSubmit={handleAdd} className={styles.inlineForm}>
          <div className="grid-2" style={{ marginBottom: 12 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Category *</label>
              <select className="form-control" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                <option>Core</option><option>Support</option>
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">MFO Name *</label>
              <input className="form-control" required value={form.mfoName} onChange={e => setForm(f => ({ ...f, mfoName: e.target.value }))} placeholder="Traffic Control Management" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Success Indicator *</label>
            <textarea className="form-control" required value={form.successIndicatorDesc} onChange={e => setForm(f => ({ ...f, successIndicatorDesc: e.target.value }))} placeholder="100% of traffic devices installed..." />
          </div>
          <button type="submit" className="btn btn-primary">Save MFO</button>
        </form>
      )}

      {loading ? <div className="loading-center"><div className="spinner" /></div> : (
        <div className="card">
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr><th>#</th><th>Category</th><th>MFO Name</th><th>Success Indicator</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {mfos.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24 }}>No MFOs defined.</td></tr>
                ) : mfos.map((m, i) => (
                  editMFO?.id === m.id ? (
                    <tr key={m.id}>
                      <td>{i+1}</td>
                      <td><select className="form-control" value={editMFO.category} onChange={e => setEditMFO(v => ({ ...v, category: e.target.value }))}><option>Core</option><option>Support</option></select></td>
                      <td><input className="form-control" value={editMFO.mfoName} onChange={e => setEditMFO(v => ({ ...v, mfoName: e.target.value }))} /></td>
                      <td><textarea className="form-control" style={{ fontSize: '0.8rem' }} value={editMFO.successIndicatorDesc || ''} onChange={e => setEditMFO(v => ({ ...v, successIndicatorDesc: e.target.value }))} /></td>
                      <td />
                      <td style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-primary btn-sm" onClick={handleUpdate}>Save</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setEditMFO(null)}>Cancel</button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={m.id}>
                      <td>{i+1}</td>
                      <td><span className={`badge badge-${m.category === 'Core' ? 'pending' : 'notstarted'}`}>{m.category}</span></td>
                      <td style={{ fontWeight: 600, maxWidth: 180 }}>{m.mfoName}</td>
                      <td style={{ fontSize: '0.8rem', maxWidth: 260 }}>{m.successIndicatorDesc}</td>
                      <td><span className={`badge ${m.active !== false ? 'badge-accomplished' : 'badge-notstarted'}`}>{m.active !== false ? '🟢 Active' : '🔴 Inactive'}</span></td>
                      <td>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          <button className="btn btn-outline btn-sm" onClick={() => setEditMFO(m)}>Edit</button>
                          <button className="btn btn-outline btn-sm" onClick={() => handleToggle(m.id, m.active !== false)}>{m.active !== false ? 'Deactivate' : 'Activate'}</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(m.id)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  )
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════ USERS TAB ══════ */
function UsersTab() {
  const [users, setUsers] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', role: 'employee', employeeId: '', displayName: '' });
  const [toast, setToast] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [u, e] = await Promise.all([getAllUsers(), getEmployees()]);
    setUsers(u); setEmployees(e); setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3000); }

  async function handleCreate(e) {
    e.preventDefault();
    try {
      await createUser({ ...form });
      showToast('✅ User created');
      setShowAdd(false);
      setForm({ email: '', password: '', role: 'employee', employeeId: '', displayName: '' });
      load();
    } catch (err) {
      alert('Failed to create user: ' + err.message);
    }
  }

  return (
    <div className={styles.tabContent}>
      {toast && <div className="alert alert-success" style={{ position: 'fixed', top: 20, right: 20, zIndex: 999, minWidth: 240 }}>{toast}</div>}
      <div className="alert alert-info">
        <strong>Tip:</strong> If an employee sees "not linked to employee record", click <strong>Edit</strong> on their account below and re-select the correct employee from the dropdown.
      </div>
      <button className="btn btn-primary" onClick={() => setShowAdd(!showAdd)}>{showAdd ? 'Cancel' : '➕ Create User Account'}</button>

      {showAdd && (
        <form onSubmit={handleCreate} className={styles.inlineForm}>
          <div className="grid-2" style={{ marginBottom: 12 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Display Name</label>
              <input className="form-control" value={form.displayName} onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))} placeholder="Juan Dela Cruz" />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Email *</label>
              <input type="email" className="form-control" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="officer@cttmo.gov.ph" />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Password *</label>
              <input type="password" className="form-control" required value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Role *</label>
              <select className="form-control" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                <option value="employee">Employee</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            {form.role === 'employee' && (
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Link to Employee *</label>
                <select className="form-control" value={form.employeeId} onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))}>
                  <option value="">-- Select Employee --</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
            )}
          </div>
          <button type="submit" className="btn btn-primary">Create Account</button>
        </form>
      )}

      {loading ? <div className="loading-center"><div className="spinner" /></div> : (
        <div className="card">
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr><th>Display Name</th><th>Email</th><th>Role</th><th>Linked Employee</th><th>Emp. Type</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24 }}>No user accounts found.</td></tr>
                ) : users.map(u => {
                  const emp = employees.find(e => e.id === u.employeeId);
                  const empType = emp?.employmentType;
                  return (
                    <tr key={u.uid}>
                      <td style={{ fontWeight: 600 }}>{u.displayName || '—'}</td>
                      <td>{u.email}</td>
                      <td><span className={`badge badge-${u.role === 'admin' ? 'pending' : 'notstarted'}`}>{u.role?.toUpperCase()}</span></td>
                      <td>{emp?.name || <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>Not linked</span>}</td>
                      <td>
                        {empType ? (
                          <span className={`badge ${empType === 'plantilla' ? 'badge-accomplished' : 'badge-pending'}`} style={{ fontSize: '0.72rem' }}>
                            {empType === 'plantilla' ? '💼 Plantilla' : '📋 JO/COS'}
                          </span>
                        ) : '—'}
                      </td>
                      <td>
                        <button className="btn btn-danger btn-sm" onClick={async () => {
                          if (!confirm('Delete this user profile?')) return;
                          await deleteUserProfile(u.uid);
                          load();
                        }}>Delete</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════ BULK IMPORT TAB ══════ */
function ImportTab() {
  const [importType, setImportType] = useState('employees');
  const [preview, setPreview] = useState([]);
  const [importing, setImporting] = useState(false);
  const [toast, setToast] = useState('');
  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3000); }

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const XLSX = await import('xlsx');
    const data = await file.arrayBuffer();
    // cellDates: parse dates; defval: '' fills empty/merged cells
    const wb = XLSX.read(data, { cellDates: true, defval: '' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
    setPreview(rows);
  }

  async function handleImport() {
    if (preview.length === 0) return;
    setImporting(true);
    try {
      if (importType === 'employees') {
        for (const row of preview) await addEmployee({
          name: row.Name || row.name,
          position: row.Position || row.position || '',
          // Accept 'Section' OR 'Division' as the 3rd column
          division: row.Division || row.division || row.Section || row.section || '',
        });
      } else {
        // Normalize category names: 'Core Functions' → 'Core', 'Support Functions' → 'Support'
        const normalizeCategory = (val) => {
          const v = String(val || '').trim();
          if (v.toLowerCase().startsWith('core')) return 'Core';
          if (v.toLowerCase().startsWith('support')) return 'Support';
          return null;
        };

        // Fill-down: Excel merged cells are empty after first row; carry forward last values
        let lastCategory = '';
        let lastMFOName = '';
        let count = 0;
        for (const row of preview) {
          // Resolve column names flexibly
          const rawCat  = row.Category  || row.category  || row['Category '] || '';
          const rawName = row['MFO Name'] || row.mfoName  || row['MFO name'] || row['Mfo Name'] || '';
          const rawInd  = row['Success Indicator'] || row.successIndicatorDesc ||
                          row['Success Indicators'] || row['Success indicator'] ||
                          row['Indicators'] || row['Indicator'] || '';

          // Carry forward if current cell is blank (merged cell)
          if (String(rawCat).trim())  lastCategory = String(rawCat).trim();
          if (String(rawName).trim()) lastMFOName  = String(rawName).trim();

          const category = normalizeCategory(lastCategory);
          const indicator = String(rawInd).trim();

          // Only import rows that have a valid category AND a success indicator
          if (category && indicator && lastMFOName) {
            await addMFO({
              category,
              mfoName: lastMFOName,
              successIndicatorDesc: indicator,
            });
            count++;
          }
        }
        showToast(`✅ Imported ${count} MFO entries`);
        setPreview([]);
        setImporting(false);
        return;
      }
      showToast(`✅ Imported ${preview.length} ${importType}`);
      setPreview([]);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className={styles.tabContent}>
      {toast && <div className="alert alert-success" style={{ position: 'fixed', top: 20, right: 20, zIndex: 999, minWidth: 240 }}>{toast}</div>}
      <div style={{ display: 'flex', gap: 12 }}>
        {['employees', 'mfos'].map(t => (
          <button key={t} className={`btn ${importType === t ? 'btn-primary' : 'btn-outline'}`} onClick={() => { setImportType(t); setPreview([]); }}>
            {t === 'employees' ? '👥 Import Employees' : '📋 Import MFOs'}
          </button>
        ))}
      </div>

      <div className="card"><div className="card-body">
        <h4 style={{ marginBottom: 8 }}>
          {importType === 'employees'
            ? 'Expected columns: Name | Position | Section (or Division)'
            : 'Expected columns: Category | MFO Name | Success Indicator — merged cells supported, "Core Functions" and "Support Functions" accepted'}
        </h4>
        <div className="form-group">
          <label className="form-label">Upload Excel (.xlsx)</label>
          <input type="file" accept=".xlsx,.xls" onChange={handleFile} className="form-control" />
        </div>
      </div></div>

      {preview.length > 0 && (
        <>
          <div className="card">
            <div className="card-header">Preview — {preview.length} rows</div>
            <div className="table-wrapper">
              <table className="data-table">
                <thead><tr>{Object.keys(preview[0]).map(k => <th key={k}>{k}</th>)}</tr></thead>
                <tbody>{preview.slice(0, 10).map((row, i) => <tr key={i}>{Object.values(row).map((v, j) => <td key={j}>{String(v)}</td>)}</tr>)}</tbody>
              </table>
            </div>
          </div>
          <button className="btn btn-primary" onClick={handleImport} disabled={importing}>
            {importing ? 'Importing…' : `Import ${preview.length} Records`}
          </button>
        </>
      )}
    </div>
  );
}

/* ══════ REVIEW SUBMISSIONS TAB ══════ */
function ReviewTab() {
  const [records, setRecords] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [mfos, setMFOs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [empFilter, setEmpFilter] = useState('All');
  const [qFilter, setQFilter] = useState('All');
  const [yearFilter, setYearFilter] = useState(2025);
  const [statusFilter, setStatusFilter] = useState('All');
  const [toast, setToast] = useState('');
  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3000); }

  const load = useCallback(async () => {
    setLoading(true);
    const [r, e, m] = await Promise.all([getRecords({ year: yearFilter }), getEmployees(), getMFOs()]);
    setRecords(r); setEmployees(e); setMFOs(m); setLoading(false);
  }, [yearFilter]);
  useEffect(() => { load(); }, [load]);

  let filtered = records;
  if (empFilter !== 'All') filtered = filtered.filter(r => r.employeeId === empFilter);
  if (qFilter !== 'All') filtered = filtered.filter(r => r.quarter === qFilter);
  if (statusFilter !== 'All') filtered = filtered.filter(r => r.status === statusFilter);

  const empGroups = {};
  filtered.forEach(r => {
    if (!empGroups[r.employeeId]) empGroups[r.employeeId] = [];
    empGroups[r.employeeId].push(r);
  });

  return (
    <div className={styles.tabContent}>
      {toast && <div className="alert alert-success" style={{ position: 'fixed', top: 20, right: 20, zIndex: 999, minWidth: 240 }}>{toast}</div>}

      <div className={styles.filters}>
        <select className="form-control" value={empFilter} onChange={e => setEmpFilter(e.target.value)}>
          <option value="All">All Employees</option>
          {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        <select className="form-control" value={qFilter} onChange={e => setQFilter(e.target.value)}>
          {['All','Q1','Q2','Q3','Q4'].map(q => <option key={q}>{q}</option>)}
        </select>
        <select className="form-control" value={yearFilter} onChange={e => setYearFilter(Number(e.target.value))}>
          {[2024,2025,2026,2027].map(y => <option key={y}>{y}</option>)}
        </select>
        <select className="form-control" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          {['All','Pending','Accomplished','Partial','Deferred'].map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      {/* Summary counts */}
      <div className="grid-4">
        {[
          { s: 'Pending', cls: 'badge-pending' },
          { s: 'Accomplished', cls: 'badge-accomplished' },
          { s: 'Partial', cls: 'badge-partial' },
          { s: 'Deferred', cls: 'badge-deferred' },
        ].map(({ s, cls }) => (
          <div key={s} className="kpi-card">
            <div className="kpi-label">{s}</div>
            <div className="kpi-value">{filtered.filter(r => r.status === s).length}</div>
          </div>
        ))}
      </div>

      {loading ? <div className="loading-center"><div className="spinner" /></div> : (
        Object.keys(empGroups).length === 0 ? (
          <div className="alert alert-info">No submissions match your filters.</div>
        ) : Object.entries(empGroups).map(([empId, recs]) => {
          const emp = employees.find(e => e.id === empId);
          return (
            <div key={empId} className="card" style={{ marginBottom: 12 }}>
              <div className="card-header">
                👤 {emp?.name || empId} — {recs.length} entries
              </div>
              <div className="card-body" style={{ padding: 0 }}>
                <div className="table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr><th>MFO</th><th>Quarter</th><th>Target</th><th>Achieved</th><th>Monthly</th><th>Status</th><th>Update</th></tr>
                    </thead>
                    <tbody>
                      {recs.map(r => {
                        const mfo = mfos.find(m => m.id === r.mfoId);
                        return (
                          <ReviewRow
                            key={r.id}
                            record={r}
                            mfoName={mfo?.mfoName || r.mfoId}
                            onSave={async (id, status, remarks) => {
                              await updateRecordStatus(id, status, remarks);
                              showToast('✅ Status updated');
                              load();
                            }}
                          />
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

function ReviewRow({ record, mfoName, onSave }) {
  const [status, setStatus] = useState(record.status || 'Pending');
  const [remarks, setRemarks] = useState(record.adminRemarks || '');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await onSave(record.id, status, remarks);
    setSaving(false);
  }

  const BADGE = { Accomplished: 'badge-accomplished', Partial: 'badge-partial', Pending: 'badge-pending', Deferred: 'badge-deferred' };

  return (
    <tr>
      <td style={{ fontWeight: 600, maxWidth: 200, fontSize: '0.85rem' }}>{mfoName}</td>
      <td style={{ textAlign: 'center' }}>{record.quarter} {record.year}</td>
      <td style={{ textAlign: 'center' }}>{record.targetQty || 0}</td>
      <td style={{ textAlign: 'center', fontWeight: 700 }}>{record.totalQty || 0}</td>
      <td style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
        {record.quantityM1 || 0} / {record.quantityM2 || 0} / {record.quantityM3 || 0}
      </td>
      <td>
        <select className="form-control" value={status} onChange={e => setStatus(e.target.value)} style={{ fontSize: '0.8rem', padding: '5px 8px' }}>
          {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
        </select>
      </td>
      <td>
        <div style={{ display: 'flex', gap: 6 }}>
          <input className="form-control" value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Remarks..." style={{ fontSize: '0.8rem', padding: '5px 8px', width: 140 }} />
          <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
            {saving ? '…' : '💾'}
          </button>
        </div>
      </td>
    </tr>
  );
}

/* ══════ MFO ASSIGNMENTS TAB ══════ */
function AssignmentsTab() {
  const [employees, setEmployees] = useState([]);
  const [mfos, setMFOs] = useState([]);
  const [selectedEmp, setSelectedEmp] = useState('');
  const [assigned, setAssigned] = useState([]); // array of mfoIds
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3000); }

  // Load Plantilla employees + MFOs on mount
  useEffect(() => {
    async function load() {
      const [emps, mfoList] = await Promise.all([getEmployees('plantilla'), getMFOs(true)]);
      setEmployees(emps);
      setMFOs(mfoList);
      if (emps.length > 0) setSelectedEmp(emps[0].id);
    }
    load();
  }, []);

  // Load existing assignments when employee changes
  useEffect(() => {
    if (!selectedEmp) return;
    setLoading(true);
    getEmployeeMFOs(selectedEmp)
      .then(ids => setAssigned(ids || []))
      .finally(() => setLoading(false));
  }, [selectedEmp]);

  function toggleMFOAssign(mfoId) {
    setAssigned(prev =>
      prev.includes(mfoId) ? prev.filter(id => id !== mfoId) : [...prev, mfoId]
    );
  }

  function selectAll() { setAssigned(mfos.map(m => m.id)); }
  function clearAll()  { setAssigned([]); }

  async function handleSave() {
    if (!selectedEmp) return;
    setSaving(true);
    try {
      await setEmployeeMFOs(selectedEmp, assigned);
      showToast(`✅ Assignments saved — ${assigned.length} MFOs assigned`);
    } catch (err) {
      showToast('❌ Failed to save: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  const emp = employees.find(e => e.id === selectedEmp);
  const coreMFOs    = mfos.filter(m => m.category === 'Core');
  const supportMFOs = mfos.filter(m => m.category === 'Support');

  return (
    <div className={styles.tabContent}>
      {toast && <div className="alert alert-success" style={{ position: 'fixed', top: 20, right: 20, zIndex: 999, minWidth: 280 }}>{toast}</div>}

      <div className="alert alert-info">
        Select an employee and check which MFOs they are responsible for. Only their assigned MFOs will appear in their <strong>My IPCR</strong> tab.
      </div>

      {/* Employee selector */}
      <div className="card">
        <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label className="form-label">Select Employee</label>
            <select className="form-control" value={selectedEmp} onChange={e => setSelectedEmp(e.target.value)}>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name} — {e.position || 'No position'}</option>)}
            </select>
          </div>
          {emp && (
            <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
              <div><strong>{assigned.length}</strong> of {mfos.length} MFOs assigned</div>
              <div style={{ marginTop: 4, width: 200 }}>
                <div className="progress-bar">
                  <div className="progress-fill accomplished" style={{ width: `${mfos.length > 0 ? (assigned.length / mfos.length) * 100 : 0}%` }} />
                </div>
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-outline btn-sm" onClick={selectAll}>Select All</button>
            <button className="btn btn-ghost btn-sm" onClick={clearAll}>Clear All</button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : (
        <>
          {/* Core Functions */}
          {coreMFOs.length > 0 && (
            <div className="card">
              <div className="card-header">⚡ Core Functions ({coreMFOs.filter(m => assigned.includes(m.id)).length}/{coreMFOs.length} assigned)</div>
              <div className="card-body">
                {coreMFOs.map(m => (
                  <label key={m.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--color-border)', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={assigned.includes(m.id)}
                      onChange={() => toggleMFOAssign(m.id)}
                      style={{ marginTop: 3, accentColor: '#FFD700', width: 18, height: 18, flexShrink: 0 }}
                    />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{m.mfoName}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: 2 }}>{m.successIndicatorDesc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Support Functions */}
          {supportMFOs.length > 0 && (
            <div className="card">
              <div className="card-header">🛠️ Support Functions ({supportMFOs.filter(m => assigned.includes(m.id)).length}/{supportMFOs.length} assigned)</div>
              <div className="card-body">
                {supportMFOs.map(m => (
                  <label key={m.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--color-border)', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={assigned.includes(m.id)}
                      onChange={() => toggleMFOAssign(m.id)}
                      style={{ marginTop: 3, accentColor: '#FFD700', width: 18, height: 18, flexShrink: 0 }}
                    />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{m.mfoName}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: 2 }}>{m.successIndicatorDesc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {mfos.length === 0 && (
            <div className="alert alert-info">No MFOs defined yet. Go to <strong>MFO Definitions</strong> tab to add them first.</div>
          )}

          {/* Save button */}
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || !selectedEmp}>
            {saving ? 'Saving…' : `💾 Save Assignments for ${emp?.name || '…'}`}
          </button>
        </>
      )}
    </div>
  );
}

/* ══════ PERFORMANCE INDICATORS DEFINITIONS TAB ══════ */
function PerformanceIndicatorsTab() {
  const [indicators, setIndicators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editPI, setEditPI] = useState(null);
  const [form, setForm] = useState({ functionName: '', indicatorDesc: '' });
  const [toast, setToast] = useState('');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('function'); // 'function' | 'indicator'
  const [sortDir, setSortDir] = useState('asc');      // 'asc' | 'desc'

  const load = useCallback(async () => { setLoading(true); setIndicators(await getIndicators()); setLoading(false); }, []);
  useEffect(() => { load(); }, [load]);
  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3000); }

  function handleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }

  // Filter then sort
  const q = search.toLowerCase();
  const visible = indicators
    .filter(pi => !q || (pi.functionName || '').toLowerCase().includes(q) || (pi.indicatorDesc || '').toLowerCase().includes(q))
    .sort((a, b) => {
      const va = sortKey === 'function' ? (a.functionName || '') : (a.indicatorDesc || '');
      const vb = sortKey === 'function' ? (b.functionName || '') : (b.indicatorDesc || '');
      return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    });

  const SortIcon = ({ col }) => {
    if (sortKey !== col) return <span style={{ opacity: 0.3, marginLeft: 4 }}>⇅</span>;
    return <span style={{ marginLeft: 4, color: '#FFD700' }}>{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  async function handleAdd(e) {
    e.preventDefault();
    await addIndicator({ functionName: form.functionName, indicatorDesc: form.indicatorDesc });
    showToast('✅ Indicator added');
    setForm({ functionName: '', indicatorDesc: '' });
    setShowAdd(false);
    load();
  }

  async function handleUpdate(e) {
    e.preventDefault();
    await updateIndicator(editPI.id, {
      functionName: editPI.functionName || '',
      indicatorDesc: editPI.indicatorDesc,
    });
    showToast('✅ Indicator updated');
    setEditPI(null);
    load();
  }

  async function handleDelete(id) {
    if (!confirm('Delete this indicator? All logs for it will become orphaned.')) return;
    await deleteIndicator(id);
    showToast('🗑️ Indicator deleted');
    load();
  }

  async function handleToggle(id, current) {
    await toggleIndicator(id, current);
    showToast(`Indicator ${current ? 'deactivated' : 'activated'}`);
    load();
  }

  return (
    <div className={styles.tabContent}>
      {toast && <div className="alert alert-success" style={{ position: 'fixed', top: 20, right: 20, zIndex: 999, minWidth: 240 }}>{toast}</div>}

      {/* Top toolbar */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <button className="btn btn-primary" onClick={() => setShowAdd(!showAdd)}>{showAdd ? 'Cancel' : '➕ Add Performance Indicator'}</button>
        <input
          className="form-control"
          style={{ maxWidth: 300, flex: 1 }}
          placeholder="🔍 Search by function or indicator…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
          {visible.length} of {indicators.length} record{indicators.length !== 1 ? 's' : ''}
        </span>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className={styles.inlineForm}>
          <div className="form-group">
            <label className="form-label">Function (Optional)</label>
            <input className="form-control" value={form.functionName} onChange={e => setForm(f => ({ ...f, functionName: e.target.value }))} placeholder="e.g. In Charge for Public Transport Routes & Services" />
          </div>
          <div className="form-group">
            <label className="form-label">Measurable Performance Indicator *</label>
            <textarea className="form-control" required rows={3} value={form.indicatorDesc} onChange={e => setForm(f => ({ ...f, indicatorDesc: e.target.value }))} placeholder="e.g. No. of route and service inspections conducted" />
          </div>
          <button type="submit" className="btn btn-primary">Save Indicator</button>
        </form>
      )}

      {loading ? <div className="loading-center"><div className="spinner" /></div> : (
        <div className="card">
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('function')}>
                    Function <SortIcon col="function" />
                  </th>
                  <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('indicator')}>
                    Measurable Performance Indicator <SortIcon col="indicator" />
                  </th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-muted)' }}>
                    {search ? `No results for "${search}"` : 'No performance indicators defined.'}
                  </td></tr>
                ) : visible.map((pi, i) => (
                  editPI?.id === pi.id ? (
                    <tr key={pi.id}>
                      <td>{i+1}</td>
                      <td><input className="form-control" value={editPI.functionName || ''} onChange={e => setEditPI(v => ({ ...v, functionName: e.target.value }))} /></td>
                      <td><textarea className="form-control" style={{ fontSize: '0.78rem' }} value={editPI.indicatorDesc || ''} onChange={e => setEditPI(v => ({ ...v, indicatorDesc: e.target.value }))} /></td>
                      <td />
                      <td style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-primary btn-sm" onClick={handleUpdate}>Save</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setEditPI(null)}>Cancel</button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={pi.id}>
                      <td>{i+1}</td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', maxWidth: 180 }}>{pi.functionName || '—'}</td>
                      <td style={{ fontSize: '0.85rem', maxWidth: 320, fontWeight: 500 }}>{pi.indicatorDesc}</td>
                      <td><span className={`badge ${pi.active !== false ? 'badge-accomplished' : 'badge-notstarted'}`}>{pi.active !== false ? '🟢 Active' : '🔴 Inactive'}</span></td>
                      <td>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          <button className="btn btn-outline btn-sm" onClick={() => setEditPI(pi)}>Edit</button>
                          <button className="btn btn-outline btn-sm" onClick={() => handleToggle(pi.id, pi.active !== false)}>{pi.active !== false ? 'Deactivate' : 'Activate'}</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(pi.id)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  )
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════ PI ASSIGNMENTS TAB ══════ */
function PIAssignmentsTab() {
  const [employees, setEmployees] = useState([]);
  const [indicators, setIndicators] = useState([]);
  const [selectedEmp, setSelectedEmp] = useState('');
  const [assigned, setAssigned] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [search, setSearch] = useState('');
  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3000); }

  useEffect(() => {
    async function load() {
      const [emps, inds] = await Promise.all([getEmployees('jo_cos'), getIndicators(true)]);
      setEmployees(emps);
      // Sort by functionName asc, then indicatorDesc asc
      inds.sort((a, b) => {
        const fa = (a.functionName || '').localeCompare(b.functionName || '');
        return fa !== 0 ? fa : (a.indicatorDesc || '').localeCompare(b.indicatorDesc || '');
      });
      setIndicators(inds);
      if (emps.length > 0) setSelectedEmp(emps[0].id);
    }
    load();
  }, []);

  useEffect(() => {
    if (!selectedEmp) return;
    setLoading(true);
    getEmployeeIndicators(selectedEmp)
      .then(ids => setAssigned(ids || []))
      .finally(() => setLoading(false));
  }, [selectedEmp]);

  function toggle(id) { setAssigned(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]); }

  async function handleSave() {
    setSaving(true);
    try {
      await setEmployeeIndicators(selectedEmp, assigned);
      showToast(`✅ Saved — ${assigned.length} indicators assigned`);
    } finally { setSaving(false); }
  }

  const emp = employees.find(e => e.id === selectedEmp);

  // Filter by search, then group by functionName
  const q = search.toLowerCase();
  const filtered = indicators.filter(pi =>
    !q ||
    (pi.functionName || '').toLowerCase().includes(q) ||
    (pi.indicatorDesc || '').toLowerCase().includes(q)
  );

  // Build groups: { functionName -> [pi, ...] }
  const groups = [];
  const seen = {};
  for (const pi of filtered) {
    const key = pi.functionName || '(No Function)';
    if (!seen[key]) { seen[key] = []; groups.push({ key, items: seen[key] }); }
    seen[key].push(pi);
  }

  function toggleGroup(items) {
    const ids = items.map(p => p.id);
    const allOn = ids.every(id => assigned.includes(id));
    setAssigned(prev =>
      allOn ? prev.filter(id => !ids.includes(id)) : [...new Set([...prev, ...ids])]
    );
  }

  return (
    <div className={styles.tabContent}>
      {toast && <div className="alert alert-success" style={{ position: 'fixed', top: 20, right: 20, zIndex: 999, minWidth: 240 }}>{toast}</div>}
      <div className="alert alert-info">Assign which Performance Indicators each employee is responsible for tracking. Only assigned indicators will appear in their 📊 Tracker tab.</div>

      <div className="card">
        <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label className="form-label">Select Employee</label>
            <select className="form-control" value={selectedEmp} onChange={e => setSelectedEmp(e.target.value)}>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name} — {e.position || ''}</option>)}
            </select>
          </div>
          {emp && <div style={{ fontSize: '0.85rem' }}><strong>{assigned.length}</strong> of {indicators.length} assigned</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-outline btn-sm" onClick={() => setAssigned(indicators.map(i => i.id))}>Select All</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setAssigned([])}>Clear All</button>
          </div>
        </div>
      </div>

      {/* Search */}
      <input
        className="form-control"
        style={{ maxWidth: 360, marginBottom: 12 }}
        placeholder="🔍 Search by function or indicator…"
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {loading ? <div className="loading-center"><div className="spinner" /></div> : (
        <>
          {indicators.length === 0 && <div className="alert alert-info">No indicators defined yet. Go to 📊 PI Definitions tab first.</div>}

          {groups.length === 0 && indicators.length > 0 && (
            <div className="alert alert-info">No results for &ldquo;{search}&rdquo;</div>
          )}

          {/* Grouped cards */}
          {groups.map(({ key, items }) => {
            const allOn = items.every(p => assigned.includes(p.id));
            const someOn = items.some(p => assigned.includes(p.id));
            return (
              <div key={key} className="card" style={{ marginBottom: 10 }}>
                <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <span style={{ fontSize: '0.88rem', fontWeight: 700 }}>{key}</span>
                  <button
                    className={`btn btn-sm ${allOn ? 'btn-outline' : 'btn-primary'}`}
                    onClick={() => toggleGroup(items)}
                    style={{ fontSize: '0.75rem', padding: '3px 10px' }}
                  >
                    {allOn ? 'Deselect All' : someOn ? 'Select Remaining' : 'Select All'}
                  </button>
                </div>
                <div className="card-body" style={{ padding: '4px 16px' }}>
                  {items.map(pi => (
                    <label key={pi.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '9px 0', borderBottom: '1px solid var(--color-border)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={assigned.includes(pi.id)} onChange={() => toggle(pi.id)} style={{ marginTop: 3, accentColor: '#FFD700', width: 17, height: 17, flexShrink: 0 }} />
                      <div style={{ fontSize: '0.88rem', fontWeight: 500 }}>{pi.indicatorDesc}</div>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}

          <button className="btn btn-primary" onClick={handleSave} disabled={saving || !selectedEmp}>
            {saving ? 'Saving…' : `💾 Save for ${emp?.name || '…'}`}
          </button>
        </>
      )}
    </div>
  );
}
