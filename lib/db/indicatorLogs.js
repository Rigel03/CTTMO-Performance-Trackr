import { supabase } from '../supabaseClient';

/**
 * Log a performance entry for an employee on a specific date.
 */
export async function logEntry({ employeeId, indicatorId, date, value, notes = '' }) {
  const { data, error } = await supabase
    .from('indicator_logs')
    .insert([{
      employee_id: employeeId,
      indicator_id: indicatorId,
      date,
      value: Number(value),
      notes
    }])
    .select();

  if (error) throw error;
  return data[0];
}

/**
 * Update an existing log entry.
 */
export async function updateEntry(logId, data) {
  const updateData = {};
  if (data.value !== undefined) updateData.value = Number(data.value);
  if (data.notes !== undefined) updateData.notes = data.notes;
  if (data.date !== undefined) updateData.date = data.date;

  const { error } = await supabase
    .from('indicator_logs')
    .update(updateData)
    .eq('id', logId);

  if (error) throw error;
}

/**
 * Delete a log entry.
 */
export async function deleteEntry(logId) {
  const { error } = await supabase
    .from('indicator_logs')
    .delete()
    .eq('id', logId);

  if (error) throw error;
}

/**
 * Get all log entries for a specific employee in a given year.
 * Optionally filter by indicatorId.
 */
export async function getLogsForEmployee({ employeeId, year, indicatorId = null }) {
  let query = supabase
    .from('indicator_logs')
    .select('*')
    .eq('employee_id', employeeId);

  if (year) {
    query = query.like('date', `${year}-%`);
  }
  
  if (indicatorId) {
    query = query.eq('indicator_id', indicatorId);
  }

  const { data, error } = await query.order('date');

  if (error) {
    console.error('Error fetching logs:', error);
    return [];
  }

  return data.map(d => ({
    id: d.id,
    employeeId: d.employee_id,
    indicatorId: d.indicator_id,
    date: d.date,
    value: d.value,
    notes: d.notes,
    loggedAt: d.logged_at
  }));
}

/**
 * Get ALL logs for a given year (admin view).
 */
export async function getAllLogs({ year }) {
  let query = supabase.from('indicator_logs').select('*');
  
  if (year) {
    query = query.like('date', `${year}-%`);
  }

  const { data, error } = await query.order('date');

  if (error) {
    console.error('Error fetching all logs:', error);
    return [];
  }

  return data.map(d => ({
    id: d.id,
    employeeId: d.employee_id,
    indicatorId: d.indicator_id,
    date: d.date,
    value: d.value,
    notes: d.notes,
    loggedAt: d.logged_at
  }));
}

/**
 * Calculate the running tally for an employee for a specific indicator in a year.
 * Returns total sum of all logged values.
 */
export async function getTally({ employeeId, indicatorId, year }) {
  const logs = await getLogsForEmployee({ employeeId, indicatorId, year });
  return logs.reduce((sum, l) => sum + (Number(l.value) || 0), 0);
}

/**
 * Get monthly breakdown of tallies for an employee (for charting).
 * Returns array of 12 numbers (Jan=0 ... Dec=11).
 */
export function computeMonthlyTallies(logs) {
  const monthly = Array(12).fill(0);
  for (const l of logs) {
    if (!l.date) continue;
    const month = parseInt(l.date.split('-')[1], 10) - 1; // 0-indexed
    monthly[month] += Number(l.value) || 0;
  }
  return monthly;
}
