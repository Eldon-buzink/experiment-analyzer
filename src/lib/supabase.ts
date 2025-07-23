import { createClient } from '@supabase/supabase-js';

// Read env vars at build time
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://wwqlopypfumjlpehccdx.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind3cWxvcHlwZnVtamxwZWhjY2R4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyNTQwNjcsImV4cCI6MjA2ODgzMDA2N30.DmzRrwR_5CZ3W1vUi-Wuf3rGJZUcXrON_HfBEnMdBWo';

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Supabase environment variables are not set');
}

export const supabase = createClient(supabaseUrl, supabaseKey); 