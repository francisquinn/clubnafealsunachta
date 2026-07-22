import type { PostgrestError } from '@supabase/supabase-js';

const UNIQUE_VIOLATION = '23505';

export function memberInsertErrorMessage(error: PostgrestError): { code: 'CONFLICT' | 'INTERNAL_SERVER_ERROR'; message: string } {
  if (error.code === UNIQUE_VIOLATION) {
    if (error.message.includes('email') || error.details?.includes('(email)')) {
      return { code: 'CONFLICT', message: 'An account with that email already exists' };
    }
    if (error.message.includes('username') || error.details?.includes('(username)')) {
      return { code: 'CONFLICT', message: 'That username is already taken' };
    }
  }

  return { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create account' };
}
