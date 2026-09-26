import React, { useState, useEffect } from 'react';
import { FiCheckCircle, FiCopy, FiServer, FiShield, FiZap } from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';

export default function TelemetryBar({ creditsUsed, conversationId, pendingCount, onOpenApprovals }) {
  const [latency, setLatency] = useState(0);

  useEffect(() => {
    const measureLatency = async () => {
      const start = performance.now();
      try {
        // Just pinging an endpoint or using an arbitrary number for telemetry mockup
        // if core.axim.us.com isn't reachable from client easily without auth, we simulate or measure connect
        await fetch('https://core.axim.us.com/health', { mode: 'no-cors' }).catch(() => {});
        const end = performance.now();
        setLatency(Math.floor(end - start));
      } catch {
        setLatency(Math.floor(Math.random() * 50) + 20); // fallback simulation
      }
    };

    measureLatency();
    const interval = setInterval(measureLatency, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleCopy = () => {
    if (conversationId) {
      navigator.clipboard.writeText(conversationId);
    }
  };

  const shortConvId = conversationId ? conversationId.substring(0, 8) : '--------';

  return (
    <div className="telemetry-bar">
      <div className="telemetry-group">
        <div className="telemetry-item">
          <span className="live-pulse"></span>
          <span>Core Edge Uplink</span>
          <strong className="font-mono">{latency}ms</strong>
        </div>
        <div className="telemetry-divider"></div>
        <div className="telemetry-item">
          <SafeIcon icon={FiServer} className="text-green-400" />
          <span>Chatbase API v2 · Verified</span>
        </div>
      </div>

      <div className="telemetry-group">
        <div className="telemetry-item">
          <SafeIcon icon={FiZap} className="text-blue-400" />
          <span>Session Credits:</span>
          <strong className="font-mono">{creditsUsed}</strong>
        </div>
        <div className="telemetry-divider"></div>
        <div className="telemetry-item copy-item" onClick={handleCopy} title="Copy Conversation ID">
          <span>Active Conversation:</span>
          <strong className="font-mono">{shortConvId}</strong>
          <SafeIcon icon={FiCopy} className="copy-icon" />
        </div>
        <div className="telemetry-divider"></div>
        <button className="telemetry-button" onClick={onOpenApprovals}>
          <SafeIcon icon={FiShield} className={pendingCount > 0 ? 'text-amber-400' : 'text-slate-400'} />
          <span>Pending Approvals</span>
          {pendingCount > 0 && <b className="telemetry-badge">{pendingCount}</b>}
        </button>
      </div>
    </div>
  );
}
