import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; // USE ANON KEY

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data: { user }, error: loginErr } = await supabase.auth.signInWithPassword({
    email: 'admin@cttmo.gov.ph',
    password: 'Password123!'
  });

  if (loginErr) {
    console.error("Login failed:", loginErr.message);
    return;
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  console.log("Profile Data:", data);
  console.log("Profile Error:", error);
}

test();
