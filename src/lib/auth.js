export function getPassportSession() {
  const cookieMatch = document.cookie.match(/(^|;)\s*axim_session=([^;]+)/);
  if (!cookieMatch) return null;

  try {
    const token = decodeURIComponent(cookieMatch[2]);
    // Optionally parse the JWT if needed
    // const base64Url = token.split('.')[1];
    // const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    // const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
    //     return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    // }).join(''));
    // const profile = JSON.parse(jsonPayload);

    return { access_token: token, profile: {} };
  } catch (error) {
    console.error('Failed to parse axim_session cookie', error);
    return null;
  }
}
