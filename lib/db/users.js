import { supabase } from '../supabaseClient';

/**
 * Create a new auth user + Supabase profile in public.profiles
 * Calls our secure Next.js API route because user creation requires the service role key.
 */
export async function createUser({ email, password, role, employeeId, displayName }) {
  const response = await fetch('/api/admin/create-user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, role, employeeId, displayName }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to create user');
  }

  return data.uid;
}

export async function getAllUsers() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, role, display_name, employee_id');
    
  if (error) {
    console.error('Error fetching users:', error);
    return [];
  }

  // Map to the shape the UI expects
  const users = data.map(d => ({
    uid: d.id,
    email: d.email,
    role: d.role,
    displayName: d.display_name,
    employeeId: d.employee_id
  }));

  // Sort client-side by email
  return users.sort((a, b) => (a.email || '').localeCompare(b.email || ''));
}

export async function getUserById(uid) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, role, display_name, employee_id')
    .eq('id', uid)
    .single();

  if (error || !data) return null;

  return {
    uid: data.id,
    email: data.email,
    role: data.role,
    displayName: data.display_name,
    employeeId: data.employee_id
  };
}

export async function updateUserProfile(uid, profileData) {
  const updateData = {};
  if (profileData.displayName !== undefined) updateData.display_name = profileData.displayName;
  if (profileData.employeeId !== undefined) updateData.employee_id = profileData.employeeId;
  if (profileData.role !== undefined) updateData.role = profileData.role;

  const { error } = await supabase
    .from('profiles')
    .update(updateData)
    .eq('id', uid);

  if (error) throw error;
}

export async function deleteUserProfile(uid) {
  // We need to delete from auth.users (which requires API route for service role),
  // but if we delete from auth.users, the cascade drops the profile.
  // Actually, wait: a client CANNOT delete another user from auth.users unless using service role.
  // Wait, in Firebase, they just deleted the document in the 'users' collection, but the auth user remained!
  // Let's emulate the original behavior: just deleting the profile row, but we can't because it's a 1-to-1 trigger.
  // For a true system, we need an API route to delete.
  // Since the original app just did `deleteDoc(doc(db, 'users', uid))`, 
  // Let's call a new API route or just use the API route for delete.
  // Actually, let's just delete the profile. But our schema says `id UUID REFERENCES auth.users(id) ON DELETE CASCADE`.
  // So deleting the profile does not delete the auth user.
  const { error } = await supabase
    .from('profiles')
    .delete()
    .eq('id', uid);

  if (error) throw error;
}
