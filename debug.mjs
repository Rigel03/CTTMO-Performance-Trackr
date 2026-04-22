import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: users } = await supabaseAdmin.auth.admin.listUsers();
  console.log("Auth Users:", users.users.map(u => ({ email: u.email, role: u.user_metadata.role })));

  const { data: profiles } = await supabaseAdmin.from('profiles').select('*');
  console.log("Profiles:", profiles);
}
check();
