import React, { useState, useEffect } from 'react';
import { FiX, FiShield, FiAlertTriangle, FiCheck } from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';
import { supabase } from '../lib/supabase';
import { tunnelRegistry } from '../services/agentTunnels';

export default function PendingApprovalsDrawer({ isOpen, onClose }) {
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchApprovals();
    }
  }, [isOpen]);

  const fetchApprovals = async () => {
    setLoading(true);
    try {
      // Fetching from supabase using the RPC function mentioned in instructions
      const { data, error } = await supabase.rpc('get_pending_approvals');
      if (error) {
        console.error('Error fetching pending approvals:', error);
      } else {
        setApprovals(data || []);
      }
    } catch (err) {
      console.error('Failed to fetch approvals:', err);
    } finally {
      setLoading(false);
    }
  };

  const dispatchToTunnel = async (approvalId, department, resolvedStatus) => {
    const roleMap = {
      'CEO': 'ceo',
      'COO': 'coo',
      'CTO': 'cto',
      'CFO': 'cfo'
    };
    const roleKey = roleMap[department] || 'ceo';
    const tunnel = tunnelRegistry.getTunnel(roleKey);

    if (tunnel) {
      try {
        await tunnel.dispatchWebhookCallback({
          action_id: approvalId,
          status: resolvedStatus,
          timestamp: new Date().toISOString()
        });
      } catch (err) {
        console.warn('Failed to dispatch webhook callback to tunnel:', err);
      }
    }
  };

  const handleAction = async (id, department, status) => {
    try {
      const { error } = await supabase.rpc('resolve_hitl_action_rpc', {
        p_action_id: id,
        p_status: status
      });

      if (error) {
        console.error(`Error updating approval ${id}:`, error);
      } else {
        // Log execution confirmation
        await supabase.from('action_approvals_log').insert([{
          action_id: id,
          department: department,
          status: status,
          executed_at: new Date().toISOString()
        }]);

        await dispatchToTunnel(id, department, status);

        // Optimistically update the local list
        setApprovals(prev => prev.filter(app => app.id !== id));
      }
    } catch (err) {
      console.error(`Failed to update approval ${id}:`, err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer-panel" onClick={e => e.stopPropagation()}>
        <div className="drawer-header">
          <div className="drawer-title">
            <SafeIcon icon={FiShield} className="text-amber-400" />
            <h2>Global Pending Approvals</h2>
            <span className="drawer-count">{approvals.length}</span>
          </div>
          <button className="drawer-close" onClick={onClose}>
            <SafeIcon icon={FiX} />
          </button>
        </div>

        <div className="drawer-content">
          {loading ? (
            <div className="drawer-loading">Loading approvals...</div>
          ) : approvals.length === 0 ? (
            <div className="drawer-empty">
              <SafeIcon icon={FiCheck} className="text-green-400 text-3xl mb-4" />
              <p>No pending approvals across all departments.</p>
            </div>
          ) : (
            <div className="drawer-list">
              {approvals.map(approval => (
                <div key={approval.id} className="drawer-card">
                  <div className="drawer-card-header">
                    <span className="department-badge">{approval.department || 'SYSTEM'}</span>
                    <span className="time-ago">{new Date(approval.created_at).toLocaleTimeString()}</span>
                  </div>
                  <h3 className="drawer-card-title">{approval.action || approval.title || 'Action Required'}</h3>
                  <div className="drawer-card-detail">
                    {approval.justification || approval.detail || JSON.stringify(approval.parameters)}
                  </div>
                  <div className="drawer-card-actions">
                    <button
                      className="btn-approve"
                      onClick={() => handleAction(approval.id, approval.department || 'SYSTEM', 'Approved')}
                    >
                      Approve & Execute
                    </button>
                    <button
                      className="btn-reject"
                      onClick={() => handleAction(approval.id, approval.department || 'SYSTEM', 'Rejected')}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
