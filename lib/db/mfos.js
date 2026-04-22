import { supabase } from '../supabaseClient';

export async function getMFOs(activeOnly = false) {
  let query = supabase
    .from('mfo_definitions')
    .select('*')
    .order('category')
    .order('mfo_name');

  if (activeOnly) {
    query = query.eq('active', true);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Error fetching MFOs:', error);
    return [];
  }

  return data.map(d => ({
    id: d.id,
    category: d.category,
    mfoName: d.mfo_name,
    successIndicatorDesc: d.success_indicator_desc,
    active: d.active
  }));
}

export async function addMFO(data) {
  const { data: inserted, error } = await supabase
    .from('mfo_definitions')
    .insert([{
      category: data.category,
      mfo_name: data.mfoName,
      success_indicator_desc: data.successIndicatorDesc,
      active: true
    }])
    .select();

  if (error) throw error;
  return inserted[0];
}

export async function updateMFO(id, data) {
  const updateData = {};
  if (data.category !== undefined) updateData.category = data.category;
  if (data.mfoName !== undefined) updateData.mfo_name = data.mfoName;
  if (data.successIndicatorDesc !== undefined) updateData.success_indicator_desc = data.successIndicatorDesc;

  const { error } = await supabase
    .from('mfo_definitions')
    .update(updateData)
    .eq('id', id);

  if (error) throw error;
}

export async function toggleMFO(id, current) {
  const { error } = await supabase
    .from('mfo_definitions')
    .update({ active: !current })
    .eq('id', id);

  if (error) throw error;
}

export async function deleteMFO(id) {
  const { error } = await supabase
    .from('mfo_definitions')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
