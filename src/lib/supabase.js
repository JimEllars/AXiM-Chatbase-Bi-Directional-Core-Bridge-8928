import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://core.axim.us.com';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT' || !session) {
    window.dispatchEvent(new CustomEvent('axim.session.event', { detail: { status: 'lost' } }));
  } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
    window.dispatchEvent(new CustomEvent('axim.session.event', { detail: { status: 'active' } }));
  }
});
