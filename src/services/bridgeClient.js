import { getPassportSession } from '../lib/auth';
import { tunnelRegistry } from './agentTunnels';
import { createLocalReply, getAgent } from './localBridge';

const CORE_GATEWAY_URL = import.meta.env.VITE_AXIM_CORE_URL || 'https://core.axim.us.com';

async function fetchWithBackoff(url, options, retries = 3) {
  let currentDelay = 1000;
  for (let i = 0; i <= retries; i++) {
    try {
      const response = await fetch(url, options);

      if (!response.ok) {
          if (response.status === 401 && i === 0) {
            // Attempt a single token refresh intercept (placeholder)
            const session = await import('../lib/auth').then(m => m.pingTokenRefresh());
            if (session) {
              const newToken = (await import('../lib/auth').then(m => m.getPassportSession()))?.access_token || '';
              options.headers = { ...options.headers, 'Authorization': `Bearer ${newToken}` };
              return await fetch(url, options);
            }
          }

          if (response.status >= 500 && i < retries) {
             throw new Error('Server Error ' + response.status); // throw to trigger retry
          }
      }
      return response;
    } catch (err) {
      if (i === retries) throw err;
      const jitter = currentDelay * 0.2 * (Math.random() * 2 - 1);
      const delay = Math.min(30000, currentDelay + jitter);
      await new Promise(resolve => setTimeout(resolve, delay));
      currentDelay = Math.min(30000, currentDelay * 1.5);
    }
  }
}

export async function sendChatMessage({ appKey, message, conversationId }) {
  // Backwards compatibility layer
  return dispatchAgentMessage(appKey, { message }, { conversationId });
}

export async function dispatchAgentMessage(agentRole, messagePayload, contextMetadata = {}) {
  const session = getPassportSession();
  const token = session?.access_token || '';

  const tunnel = tunnelRegistry.getTunnel(agentRole);
  const agentConfig = getAgent(agentRole);

  let conversationId = contextMetadata.conversationId;
    const convKey = `axim.chatbase.conversation.${agentRole}`;

  if (!conversationId) {
    conversationId = sessionStorage.getItem(convKey);
  }

  // Use agentTunnel queue if disconnected
  if (tunnel && tunnel.status === 'disconnected') {
      tunnel.queueMessage({ ...messagePayload, conversationId });
      return { status: 'queued', message: 'Message queued pending reconnection.' };
  }

  try {
    const response = await fetchWithBackoff(`${CORE_GATEWAY_URL}/functions/v1/chatbase-gateway`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        app_key: agentRole.toLowerCase(),
        agent_id: tunnel?.agentId || agentConfig?.id,
        message: messagePayload.message || JSON.stringify(messagePayload),
        conversationId: conversationId || undefined
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Gateway error (${response.status})`);
    }

    const data = await response.json();

    if (data.conversationId) {
       sessionStorage.setItem(convKey, data.conversationId);
    }

    return data;
  } catch (err) {
    console.warn(`[bridgeClient] Core gateway dispatch failed for ${agentRole}, using local fallback. Error:`, err.message);

    // Deterministic fallback using localBridge
    const fallbackResponse = {
       reply: createLocalReply(agentConfig || { name: agentRole }, messagePayload.message || ''),
       conversationId: conversationId || `local-conv-${Date.now()}`,
       fallback: true
    };

    sessionStorage.setItem(convKey, fallbackResponse.conversationId);

    return fallbackResponse;
  }
}

export function listenToTunnel(agentRole, onMessageCallback) {
  const tunnel = tunnelRegistry.getTunnel(agentRole);
  if (tunnel) {
    return tunnel.onMessage(onMessageCallback);
  }
  return () => {}; // no-op if tunnel not found
}

export async function sendActionResolution(payload) {
  const session = getPassportSession();
  const token = session?.access_token || '';

  // Since we don't have the role in the signature of sendActionResolution, we just broadcast or send to a generic endpoint.
  // Wait, looking at the previous code, it used to lookup a tunnel based on department.
  // Actually, sendActionResolution only has the resolution payload according to prompt.
  // Let's implement it.

  const response = await fetchWithBackoff(`${CORE_GATEWAY_URL}/functions/v1/tunnel-webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Failed to send resolution: ${response.status}`);
  }
  return response.json();
}
