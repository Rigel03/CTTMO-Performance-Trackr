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
  let isMounted = true;

  async function handleSession(session) {
    if (!isMounted) return;
    if (session?.user) {
      try {
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
              
            if (empData) employmentType = empData.employment_type || 'plantilla';
          } catch (_) {}
        }
        if (isMounted) cb({ uid: user.id, email: user.email, ...profile, employmentType });
      } catch (err) {
        console.error("Error handling session:", err);
        if (isMounted) cb(null);
      }
    } else {
      if (isMounted) cb(null);
    }
  }

  // Fetch initial session safely
  supabase.auth.getSession().then(({ data: { session } }) => {
    handleSession(session);
  }).catch(() => {
    if (isMounted) cb(null);
  });

  const { data: authListener } = supabase.auth.onAuthStateChange(
    (event, session) => {
      // Ignore INITIAL_SESSION from the listener since we manually fetch it
      if (event === 'INITIAL_SESSION') return;
      handleSession(session);
    }
  );

  return () => {
    isMounted = false;
    authListener?.subscription.unsubscribe();
  };
}
