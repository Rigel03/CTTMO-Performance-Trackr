import { createClient } from '@supabase/supabase-js';

export async function POST(request) {
  try {
    const body = await request.json();
    const { email, password, role, employeeId, displayName } = body;

    // We must use the service_role key to bypass RLS and use the admin auth API
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // 1. Create the user in auth.users
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        role,
        displayName,
      }
    });

    if (authError) {
      return new Response(JSON.stringify({ error: authError.message }), { status: 400 });
    }

    const uid = authData.user.id;

    // 2. The trigger `on_auth_user_created` will auto-create the profile row.
    // We just need to update it with the employeeId if it was provided,
    // since the trigger doesn't have access to employeeId (not in user_metadata).
    if (employeeId) {
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update({ employee_id: employeeId })
        .eq('id', uid);
        
      if (profileError) {
        // Not a fatal error since user is created, but we log it
        console.error('Failed to link employee ID to profile:', profileError);
      }
    }

    return new Response(JSON.stringify({ uid }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
