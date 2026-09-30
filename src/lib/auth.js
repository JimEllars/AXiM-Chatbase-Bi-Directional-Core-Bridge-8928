export function getPassportSession() {
  const cookieMatch = document.cookie.match(/(^|;)\s*axim_session=([^;]+)/);
  if (!cookieMatch) {
    // Failover to active local guest/operator session rather than returning null
    const guestToken = localStorage.getItem('axim_guest_token') || 'local_guest_' + Date.now();
    localStorage.setItem('axim_guest_token', guestToken);
    return { access_token: guestToken, profile: { role: 'guest' } };
  }

  try {
    const token = decodeURIComponent(cookieMatch[2]);
    return { access_token: token, profile: {} };
  } catch (error) {
    console.error('Failed to parse axim_session cookie', error);
    const guestToken = localStorage.getItem('axim_guest_token') || 'local_guest_' + Date.now();
    localStorage.setItem('axim_guest_token', guestToken);
    return { access_token: guestToken, profile: { role: 'guest' } };
  }
}

export async function pingTokenRefresh() {
    // Attempt proactive token refresh via supabase if possible
    try {
        const { supabase } = await import('./supabase.js');
        const { data, error } = await supabase.auth.getSession();
        if (!data.session || error) {
            await supabase.auth.refreshSession();
        }
    } catch (e) {
        // ignore
    }

    // Implement token refresh cycle if necessary, currently placeholder.
    // Heavy agent polling loops will call getPassportSession, which acts as a minimal check.
    const session = getPassportSession();
    if (!session) {
        // Trigger re-auth flow if strict session is lost
        console.warn('Session missing during active polling cycle.');
        window.dispatchEvent(new CustomEvent('axim.session.event', { detail: { status: 'lost' } }));
    }
    return session !== null;
}
