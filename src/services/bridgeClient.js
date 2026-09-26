import { getPassportSession } from '../lib/auth';

const CORE_GATEWAY_URL = import.meta.env.VITE_AXIM_CORE_URL || 'https://core.axim.us.com';

export async function sendChatMessage({ appKey, message, conversationId }) {
  const session = getPassportSession();
  const token = session?.access_token || '';

  const response = await fetch(`${CORE_GATEWAY_URL}/functions/v1/chatbase-gateway`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      app_key: appKey.toLowerCase(),
      message,
      conversationId: conversationId || undefined
    })
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `Gateway error (${response.status})`);
  }

  return await response.json();
}
