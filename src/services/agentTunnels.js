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
    this.initialBackoffDelay = 500;
    this.maxBackoffDelay = 8000;
    this.callbacks = new Set();
    this.heartbeatInterval = null;
    this.backoffDelay = this.initialBackoffDelay;
    this.consecutiveFailures = 0;
    this.isDraining = false;
    this.loadQueue();
  }


  saveQueue() {
    try {
      localStorage.setItem(`axim.tunnel.${this.role}.queue`, JSON.stringify(this.messageQueue));
    } catch (e) {
      console.warn('Failed to save queue to localStorage', e);
    }
  }

  loadQueue() {
    try {
      const stored = localStorage.getItem(`axim.tunnel.${this.role}.queue`);
      if (stored) {
        this.messageQueue = JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to load queue from localStorage', e);
    }
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
         this.backoffDelay = this.initialBackoffDelay; // reset on success
         this.consecutiveFailures = 0;
         this.drainQueue();
      } else {
         // simulated local fallback latency if actual core is unreachable
         this.latency = Math.floor(Math.random() * 50) + 20;
         this.status = 'degraded';
         this.backoffDelay = this.initialBackoffDelay; // reset on degraded but responsive
         this.consecutiveFailures = 0;
         this.drainQueue();
      }
    } catch (err) {
      this.consecutiveFailures++;
      if (this.consecutiveFailures >= 5) {
        this.status = 'degraded';
        // emit telemetry event
        window.dispatchEvent(new CustomEvent('axim.telemetry.event', { detail: { role: this.role, status: 'degraded' } }));
      } else {
        this.status = 'disconnected';
      }
      this.latency = 0;
      this.applyBackoff();
    }
  }

  applyBackoff() {
     this.stopHeartbeat();
     const jitter = this.backoffDelay * 0.2 * (Math.random() * 2 - 1);
     const delay = Math.min(this.maxBackoffDelay, this.backoffDelay + jitter);

     setTimeout(() => {
        this.verifyHeartbeat();
        this.startHeartbeat(); // restart polling
     }, delay);

     this.backoffDelay = Math.min(this.maxBackoffDelay, this.backoffDelay * 2);
  }

  queueMessage(payload) {
     if (this.messageQueue.length >= 50) {
         this.messageQueue.shift(); // FIFO
     }
     this.messageQueue.push(payload);
     this.saveQueue();
     if (this.status === 'connected') {
         this.drainQueue();
     }
  }

  async drainQueue() {
     if (this.isDraining || this.messageQueue.length === 0) return;
     this.isDraining = true;

     const session = getPassportSession();
     const token = session?.access_token || '';

     while (this.messageQueue.length > 0 && this.status === 'connected') {
         const payload = this.messageQueue[0];
         try {
             let response;
             if (payload.type === 'webhook_callback') {
                 response = await fetch(`${CORE_GATEWAY_URL}/functions/v1/tunnel-webhook`, {
                     method: 'POST',
                     headers: {
                       'Content-Type': 'application/json',
                       'Authorization': `Bearer ${token}`
                     },
                     body: JSON.stringify({
                       agent_role: this.role,
                       agent_id: this.agentId,
                       action_id: payload.action_id,
                       status: payload.status,
                       timestamp: payload.timestamp
                     })
                 });
             } else {
                 response = await fetch(`${CORE_GATEWAY_URL}/functions/v1/chatbase-gateway`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                      },
                      body: JSON.stringify({
                        app_key: this.role.toLowerCase(),
                        agent_id: this.agentId,
                        message: payload.message || JSON.stringify(payload),
                        conversationId: payload.conversationId || undefined
                      })
                 });
             }
             if (response.ok) {
                 this.messageQueue.shift(); // success, remove from queue
                 this.saveQueue();
             } else {
                 break; // pause draining on error
             }
         } catch (err) {
             break; // pause draining on error
         }
     }
     this.isDraining = false;
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
