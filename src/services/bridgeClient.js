import { getPassportSession } from '../lib/auth';
import { tunnelRegistry } from './agentTunnels';
import { createLocalReply, getAgent } from './localBridge';

const CORE_GATEWAY_URL = import.meta.env.VITE_AXIM_CORE_URL || 'https://core.axim.us.com';

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

  try {
    const response = await fetch(`${CORE_GATEWAY_URL}/functions/v1/chatbase-gateway`, {
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
