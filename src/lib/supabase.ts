import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.SUPABASE_PROJECT_URL || import.meta.env.PUBLIC_SUPABASE_PROJECT_URL;
const supabaseKey = process.env.SUPABASE_API_KEY || import.meta.env.PUBLIC_SUPABASE_API_KEY;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

export const supabase = (supabaseUrl && supabaseKey)
  ? createClient(supabaseUrl, supabaseKey)
  : null;

export const supabaseAdmin = (supabaseUrl && supabaseSecretKey)
  ? createClient(supabaseUrl, supabaseSecretKey)
  : null;
