import { getPassportSession } from '../lib/auth';

const CORE_GATEWAY_URL = import.meta.env.VITE_AXIM_CORE_URL || 'https://core.axim.us.com';

class AgentTunnel {
  constructor(role, config) {
    this.role = role;
    this.agentId = config.agentId;
    this.botKey = config.botKey;
    this.status = 'disconnected'; // 'connected', 'degraded', 'disconnected', 'polling'
    this.latency = 0;
    this.messageQueue = [];
    this.callbacks = new Set();
    this.heartbeatInterval = null;
  }

  async verifyHeartbeat() {
    const start = performance.now();
    try {
      this.status = 'polling';
      // Fallback endpoint if core gateway isn't active
      const response = await fetch(`${CORE_GATEWAY_URL}/health`, { mode: 'no-cors' }).catch(() => null);
      const end = performance.now();

      this.latency = Math.floor(end - start);

      if (response) {
         this.status = 'connected';
      } else {
         // simulated local fallback latency if actual core is unreachable
         this.latency = Math.floor(Math.random() * 50) + 20;
         this.status = 'degraded';
      }
    } catch (err) {
      this.status = 'disconnected';
      this.latency = 0;
    }
  }

  startHeartbeat(intervalMs = 5000) {
    if (this.heartbeatInterval) return;
    this.verifyHeartbeat();
    this.heartbeatInterval = setInterval(() => this.verifyHeartbeat(), intervalMs);
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  onMessage(callback) {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  async dispatchWebhookCallback(payload) {
    const session = getPassportSession();
    const token = session?.access_token || '';

    try {
      const response = await fetch(`${CORE_GATEWAY_URL}/functions/v1/tunnel-webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          agent_role: this.role,
          agent_id: this.agentId,
          ...payload
        })
      });

      if (!response.ok) {
        throw new Error(`Webhook dispatch failed: ${response.statusText}`);
      }

      return await response.json().catch(() => ({}));
    } catch (err) {
      console.warn(`[Tunnel ${this.role}] Webhook dispatch error:`, err);
      throw err;
    }
  }
}

class TunnelRegistry {
  constructor() {
    this.tunnels = new Map();
    this.registerCoreTunnels();
  }

  registerCoreTunnels() {
    const coreAgents = {
      ceo: { agentId: import.meta.env.VITE_CEO_AGENT_ID || 'fViIyS2-64jXMyakjf70T', botKey: import.meta.env.VITE_CEO_BOT_KEY || 'default_bot_key' },
      coo: { agentId: import.meta.env.VITE_COO_AGENT_ID || '7biTg1Hu6DMWXUpTWfCLu', botKey: import.meta.env.VITE_COO_BOT_KEY || 'default_bot_key' },
      cto: { agentId: import.meta.env.VITE_CTO_AGENT_ID || 'CgplD95DZW5tnXRPEGV2A', botKey: import.meta.env.VITE_CTO_BOT_KEY || 'default_bot_key' },
      cfo: { agentId: import.meta.env.VITE_CFO_AGENT_ID || 'NHjryFStm6hn2kg6q7KgN', botKey: import.meta.env.VITE_CFO_BOT_KEY || 'default_bot_key' },
      legal: { agentId: import.meta.env.VITE_LEGAL_AGENT_ID || 'ioJLtMqvhqx69Mokhad64', botKey: import.meta.env.VITE_LEGAL_BOT_KEY || 'default_bot_key' },
      onyx_direct: { agentId: 'onyx_direct_mk3', botKey: 'onyx_bypass' }
    };

    for (const [role, config] of Object.entries(coreAgents)) {
      this.registerTunnel(role, config);
    }
  }

  registerTunnel(role, config) {
    const tunnel = new AgentTunnel(role, config);
    this.tunnels.set(role, tunnel);
    tunnel.startHeartbeat();
  }

  getTunnel(role) {
    return this.tunnels.get(role);
  }

  getAllTunnels() {
    return Array.from(this.tunnels.values());
  }
}

export const tunnelRegistry = new TunnelRegistry();
