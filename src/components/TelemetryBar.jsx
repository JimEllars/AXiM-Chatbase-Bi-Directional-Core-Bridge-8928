import React, { useState, useEffect, useRef } from 'react';
import { FiCheckCircle, FiCopy, FiServer, FiShield, FiZap, FiAlertTriangle, FiXCircle } from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';
import { tunnelRegistry } from '../services/agentTunnels';
import { getPassportSession } from '../lib/auth';

export default function TelemetryBar({ creditsUsed, conversationId, pendingCount, onOpenApprovals }) {
  const [latency, setLatency] = useState(0);
  const [tunnelStatus, setTunnelStatus] = useState('disconnected');
  const [bufferCount, setBufferCount] = useState(0);
  const [activeTunnels, setActiveTunnels] = useState(0);
  const animationRef = useRef();

  useEffect(() => {
    let lastUpdate = 0;
    const pollingInterval = 1000; // Update UI every 1s

    const updateTelemetry = (timestamp) => {
      if (timestamp - lastUpdate > pollingInterval) {
        lastUpdate = timestamp;

        // Ensure tokens are fresh for polling if needed
        // (In a real app, calling getPassportSession might trigger a refresh if expired)
        getPassportSession();

        const tunnels = tunnelRegistry.getAllTunnels();

        if (tunnels.length > 0) {
          let totalLatency = 0;
          let validCount = 0;
          let worstStatus = 'connected';
          let totalBufferCount = 0;

          tunnels.forEach(t => {
            if (t.latency > 0) {
              totalLatency += t.latency;
              validCount++;
            }

            if (t.status === 'disconnected') worstStatus = 'disconnected';
            else if (t.status === 'degraded' && worstStatus !== 'disconnected') worstStatus = 'degraded';
            else if (t.status === 'polling' && worstStatus === 'connected') worstStatus = 'polling';

            if (t.messageQueue && t.messageQueue.length > 0) {
              totalBufferCount += t.messageQueue.length;
            }
          });

          let avgLatency = validCount > 0 ? Math.floor(totalLatency / validCount) : 0;
          setLatency(avgLatency);

          if (totalBufferCount > 0) {
            if (worstStatus === 'connected' || worstStatus === 'polling') {
                worstStatus = 'degraded';
            }
          }
          if (avgLatency >= 150 && avgLatency <= 400) {
              worstStatus = 'degraded';
          } else if (avgLatency > 400) {
              worstStatus = 'disconnected';
          }

          setTunnelStatus(worstStatus);
          setBufferCount(totalBufferCount);
          setActiveTunnels(tunnels.filter(t => t.status === 'connected' || t.status === 'degraded' || t.status === 'polling').length);
        }
      }

      animationRef.current = requestAnimationFrame(updateTelemetry);
    };

    animationRef.current = requestAnimationFrame(updateTelemetry);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  const handleCopy = () => {
    if (conversationId) {
      navigator.clipboard.writeText(conversationId);
    }
  };

  const shortConvId = conversationId ? conversationId.substring(0, 8) : '--------';

  const getStatusIcon = () => {
    switch (tunnelStatus) {
      case 'connected': return { icon: FiCheckCircle, color: 'text-green-400', label: 'Operational' };
      case 'degraded': return { icon: FiAlertTriangle, color: 'text-amber-400', label: 'Degraded' };
      case 'polling': return { icon: FiZap, color: 'text-blue-400', label: 'Polling' };
      default: return { icon: FiXCircle, color: 'text-red-400', label: 'Disconnected' };
    }
  };

  const statusInfo = getStatusIcon();

  return (
    <div className="telemetry-bar">
      <div className="telemetry-group">
        <div className="telemetry-item">
          <span className={`live-pulse ${tunnelStatus === 'connected' ? 'bg-green-500' : tunnelStatus === 'degraded' ? 'bg-amber-500' : 'bg-red-500'}`}></span>
          <span>Core Edge Uplink {activeTunnels > 0 ? `(${activeTunnels} active)` : ''}</span>
          <strong className="font-mono">{latency > 0 ? `${latency}ms` : '---'}</strong>
        </div>
        <div className="telemetry-divider"></div>
        <div className="telemetry-item">
          <SafeIcon icon={statusInfo.icon} className={statusInfo.color} />
          <span>Chatbase API v2 · {statusInfo.label} {bufferCount > 0 ? ` (${bufferCount} queued)` : ''}</span>
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
