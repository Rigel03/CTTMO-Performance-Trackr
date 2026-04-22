import { supabase } from '../supabaseClient';

/**
 * Assign a list of MFO IDs to an employee.
 * Replaces the entire assignment for this employee.
 */
export async function setEmployeeMFOs(employeeId, mfoIds = []) {
  // 1. Delete all existing assignments for this employee
  const { error: deleteError } = await supabase
    .from('mfo_assignments')
    .delete()
    .eq('employee_id', employeeId);

  if (deleteError) throw deleteError;

  // 2. Insert new assignments
  if (mfoIds.length > 0) {
    const insertData = mfoIds.map(mfoId => ({
      employee_id: employeeId,
      mfo_id: mfoId
    }));

    const { error: insertError } = await supabase
      .from('mfo_assignments')
      .insert(insertData);

    if (insertError) throw insertError;
  }
}

/**
 * Get the list of MFO IDs assigned to an employee.
 * Returns an empty array if none assigned.
 */
export async function getEmployeeMFOs(employeeId) {
  const { data, error } = await supabase
    .from('mfo_assignments')
    .select('mfo_id')
    .eq('employee_id', employeeId);

  if (error) {
    console.error('Error fetching employee MFOs:', error);
    return [];
  }

  return data.map(d => d.mfo_id);
}
