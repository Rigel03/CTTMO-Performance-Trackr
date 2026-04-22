import { supabase } from './supabaseClient';

/**
 * Sign in with email and password.
 * Returns user profile object with role.
 */
export async function loginUser(email, password) {
  const { data: { user }, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw error;
  }

  const profile = await getUserProfile(user.id);
  return { uid: user.id, email: user.email, ...profile };
}

/**
 * Sign out the current user.
 */
export async function logoutUser() {
  await supabase.auth.signOut();
}

/**
 * Get user profile from Supabase profiles table.
 */
export async function getUserProfile(uid) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', uid)
    .single();

  if (error || !data) {
    return { role: 'employee', employeeId: null, displayName: '' };
  }

  return {
    role: data.role,
    employeeId: data.employee_id,
    displayName: data.display_name,
  };
}

/**
 * Subscribe to auth state changes.
 * cb(user) is called with full profile (including employmentType) or null.
 */
export function onAuthChange(cb) {
  const { data: authListener } = supabase.auth.onAuthStateChange(
    async (event, session) => {
      if (session?.user) {
        const user = session.user;
        const profile = await getUserProfile(user.id);
        let employmentType = null;
        
        if (profile.employeeId) {
          try {
            const { data: empData } = await supabase
              .from('employees')
              .select('employment_type')
              .eq('id', profile.employeeId)
              .single();
              
            if (empData) {
              employmentType = empData.employment_type || 'plantilla';
            }
          } catch (_) {
            // silently fall back
          }
        }
        cb({ uid: user.id, email: user.email, ...profile, employmentType });
      } else {
        cb(null);
      }
    }
  );

  return () => {
    authListener?.subscription.unsubscribe();
  };
}
