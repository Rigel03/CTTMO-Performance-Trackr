import { supabase } from '../supabaseClient';

export async function getIndicators(activeOnly = false) {
  let query = supabase.from('performance_indicators').select('*').order('indicator_desc');

  if (activeOnly) {
    query = query.eq('active', true);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Error fetching indicators:', error);
    return [];
  }

  return data.map(d => ({
    id: d.id,
    indicatorDesc: d.indicator_desc,
    active: d.active
  }));
}

export async function getIndicatorById(id) {
  const { data, error } = await supabase
    .from('performance_indicators')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    indicatorDesc: data.indicator_desc,
    active: data.active
  };
}

export async function addIndicator(data) {
  const { data: inserted, error } = await supabase
    .from('performance_indicators')
    .insert([{
      indicator_desc: data.indicatorDesc,
      active: true
    }])
    .select();

  if (error) throw error;
  return inserted[0];
}

export async function updateIndicator(id, data) {
  const updateData = {};
  if (data.indicatorDesc !== undefined) updateData.indicator_desc = data.indicatorDesc;

  const { error } = await supabase
    .from('performance_indicators')
    .update(updateData)
    .eq('id', id);

  if (error) throw error;
}

export async function toggleIndicator(id, current) {
  const { error } = await supabase
    .from('performance_indicators')
    .update({ active: !current })
    .eq('id', id);

  if (error) throw error;
}

export async function deleteIndicator(id) {
  const { error } = await supabase
    .from('performance_indicators')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

/**
 * Get the list of Indicator IDs assigned to an employee.
 */
export async function getEmployeeIndicators(employeeId) {
  const { data, error } = await supabase
    .from('indicator_assignments')
    .select('indicator_id')
    .eq('employee_id', employeeId);

  if (error) {
    console.error('Error fetching employee indicators:', error);
    return [];
  }

  return data.map(d => d.indicator_id);
}

export async function setEmployeeIndicators(employeeId, indicatorIds = []) {
  // 1. Delete all existing assignments
  const { error: deleteError } = await supabase
    .from('indicator_assignments')
    .delete()
    .eq('employee_id', employeeId);

  if (deleteError) throw deleteError;

  // 2. Insert new assignments
  if (indicatorIds.length > 0) {
    const insertData = indicatorIds.map(indicatorId => ({
      employee_id: employeeId,
      indicator_id: indicatorId
    }));

    const { error: insertError } = await supabase
      .from('indicator_assignments')
      .insert(insertData);

    if (insertError) throw insertError;
  }
}
