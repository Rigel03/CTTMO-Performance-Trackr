import { supabase } from '../supabaseClient';

/**
 * Build a deterministic document ID so updates overwrite existing records.
 */
export function buildRecordId(employeeId, mfoId, quarter, year) {
  return `${employeeId}_${mfoId}_${quarter}_${year}`;
}

export async function getRecords({ employeeId, year, quarter } = {}) {
  let query = supabase.from('performance_records').select('*');
  
  if (employeeId) query = query.eq('employee_id', employeeId);
  if (year) query = query.eq('year', year);
  if (quarter) query = query.eq('quarter', quarter);

  const { data, error } = await query;
  
  if (error) {
    console.error('Error fetching records:', error);
    return [];
  }

  return data.map(d => ({
    id: d.id,
    employeeId: d.employee_id,
    mfoId: d.mfo_id,
    quarter: d.quarter,
    year: d.year,
    targetQty: d.target_qty,
    totalQty: d.total_qty,
    quantityM1: d.quantity_m1,
    quantityM2: d.quantity_m2,
    quantityM3: d.quantity_m3,
    status: d.status,
    adminRemarks: d.admin_remarks,
    updatedAt: d.updated_at
  }));
}

export async function saveRecord(employeeId, mfoId, quarter, year, payload) {
  const id = buildRecordId(employeeId, mfoId, quarter, year);
  
  const { error } = await supabase
    .from('performance_records')
    .upsert({
      id,
      employee_id: employeeId,
      mfo_id: mfoId,
      quarter,
      year,
      target_qty: payload.targetQty || 0,
      total_qty: payload.totalQty || 0,
      quantity_m1: payload.quantityM1 || 0,
      quantity_m2: payload.quantityM2 || 0,
      quantity_m3: payload.quantityM3 || 0,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'id'
    });

  if (error) throw error;
}

export async function updateRecordStatus(id, status, adminRemarks) {
  const { error } = await supabase
    .from('performance_records')
    .update({
      status,
      admin_remarks: adminRemarks,
      reviewed_at: new Date().toISOString()
    })
    .eq('id', id);

  if (error) throw error;
}

export async function deleteRecord(id) {
  const { error } = await supabase
    .from('performance_records')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
