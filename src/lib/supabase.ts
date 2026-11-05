import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.SUPABASE_PROJECT_URL || import.meta.env?.PUBLIC_SUPABASE_PROJECT_URL;
const supabaseKey = process.env.SUPABASE_API_KEY || import.meta.env?.PUBLIC_SUPABASE_API_KEY;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;
// import.meta.env is optional-chained: #205's deploy-succeeded Netlify
// function imports this outside Astro's build, where it doesn't exist.

export const supabase = (supabaseUrl && supabaseKey)
  ? createClient(supabaseUrl, supabaseKey)
  : null;

export const supabaseAdmin = (supabaseUrl && supabaseSecretKey)
  ? createClient(supabaseUrl, supabaseSecretKey)
  : null;
