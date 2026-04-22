import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE keys in .env.local');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function createMasterAdmin() {
  console.log('Creating Master Admin account...');
  
  const email = 'admin@cttmo.gov.ph';
  const password = 'Password123!';

  // 1. Create in auth.users
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      role: 'admin',
      displayName: 'System Admin'
    }
  });

  if (error) {
    console.error('Error creating user:', error.message);
    // If user already exists, let's just promote them to admin
    if (error.message.includes('already registered')) {
      console.log(`User ${email} already exists. Promoting to Admin...`);
      const { data: users } = await supabaseAdmin.auth.admin.listUsers();
      const user = users.users.find(u => u.email === email);
      
      if (user) {
        await supabaseAdmin.from('profiles').update({ role: 'admin' }).eq('id', user.id);
        console.log('✅ Promoted existing user to Admin.');
      }
    }
    return;
  }

  // 2. The database trigger will automatically create the profile row and set role='admin'
  console.log(`✅ Master Admin created successfully!`);
  console.log(`Email: ${email}`);
  console.log(`Password: ${password}`);
  console.log(`\nYou can now log in with these credentials, go to the "System Users" tab, and set up your employees.`);
}

createMasterAdmin();
