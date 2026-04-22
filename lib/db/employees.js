import { supabase } from '../supabaseClient';

export async function getEmployees(employmentType = null) {
  let query = supabase.from('employees').select('*').order('name');
  
  if (employmentType) {
    query = query.eq('employment_type', employmentType);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Error fetching employees:', error);
    return [];
  }

  // Map snake_case to camelCase
  return data.map(d => ({
    id: d.id,
    name: d.name,
    position: d.position,
    section: d.section,
    division: d.division,
    employmentType: d.employment_type
  }));
}

export async function addEmployee(data) {
  const { data: inserted, error } = await supabase
    .from('employees')
    .insert([{
      name: data.name,
      position: data.position,
      section: data.section,
      division: data.division,
      employment_type: data.employmentType || 'plantilla'
    }])
    .select();

  if (error) throw error;
  return inserted[0];
}

export async function updateEmployee(id, data) {
  const updateData = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.position !== undefined) updateData.position = data.position;
  if (data.section !== undefined) updateData.section = data.section;
  if (data.division !== undefined) updateData.division = data.division;
  if (data.employmentType !== undefined) updateData.employment_type = data.employmentType;

  const { error } = await supabase
    .from('employees')
    .update(updateData)
    .eq('id', id);

  if (error) throw error;
}

export async function deleteEmployee(id) {
  const { error } = await supabase
    .from('employees')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
