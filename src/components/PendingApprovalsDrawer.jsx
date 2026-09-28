import React, { useState, useEffect } from 'react';
import { FiX, FiShield, FiAlertTriangle, FiCheck } from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';
import { supabase } from '../lib/supabase';
import { tunnelRegistry } from '../services/agentTunnels';
import { sendActionResolution } from '../services/bridgeClient';

export default function PendingApprovalsDrawer({ isOpen, onClose }) {
    const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState(null);
  const [errorBanner, setErrorBanner] = useState(null);



  useEffect(() => {
    const handleRealtimeUpdate = (payload) => {
       fetchApprovals(); // Simplest way to sync state is re-fetching.
    };

    const channel = supabase
      .channel('public:agent_approvals')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agent_approvals' }, (payload) => {
        handleRealtimeUpdate(payload);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    } else {
      window.removeEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      // Hydrate from cache first
      try {
        const cached = localStorage.getItem('axim.approvals.cache');
        if (cached) {
          const parsed = JSON.parse(cached);
          // check TTL (30 min)
          if (Date.now() - parsed.timestamp < 30 * 60 * 1000) {
            setApprovals(parsed.data || []);
          }
        }
      } catch (e) {
         console.warn('Failed to parse cached approvals');
      }
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
        const approvalData = data || [];
        setApprovals(approvalData);
        localStorage.setItem('axim.approvals.cache', JSON.stringify({
            timestamp: Date.now(),
            data: approvalData
        }));
      }

    } catch (err) {
      console.error('Failed to fetch approvals:', err);
    } finally {
      setLoading(false);
    }
  };

  const dispatchToTunnel = async (approvalId, department, resolvedStatus) => {
    const resolutionPayload = {
      actionId: approvalId,
      status: resolvedStatus,
      timestamp: new Date().toISOString(),
      resolvedBy: 'current_user_or_system',
      notes: ''
    };
    try {
      await sendActionResolution(resolutionPayload);
    } catch (err) {
      console.warn('Failed to dispatch resolution:', err);
    }
  };


  const handleAction = async (id, department, status) => {
    setProcessingId(id);
    setErrorBanner(null);

    // Cache the old list for rollback
    const previousApprovals = [...approvals];

    // Optimistically update the list
    const updatedApprovals = approvals.filter(app => app.id !== id);
    setApprovals(updatedApprovals);
    localStorage.setItem('axim.approvals.cache', JSON.stringify({
        timestamp: Date.now(),
        data: updatedApprovals
    }));

    try {
      const { error } = await supabase.rpc('resolve_hitl_action_rpc', {
        p_action_id: id,
        p_status: status
      });

      if (error) {
        throw error;
      } else {
        await supabase.from('action_approvals_log').insert([{
          action_id: id,
          department: department,
          status: status,
          executed_at: new Date().toISOString()
        }]);

        await dispatchToTunnel(id, department, status);
      }
    } catch (err) {
      console.error(`Failed to update approval ${id}:`, err);
      // Revert optimistic update
      setApprovals(previousApprovals);
      localStorage.setItem('axim.approvals.cache', JSON.stringify({
          timestamp: Date.now(),
          data: previousApprovals
      }));
      setErrorBanner(`Failed to execute ${status} for action.`);
    } finally {
      setProcessingId(null);
    }
  };


  if (!isOpen) return null;

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer-panel bg-slate-900/80 backdrop-blur-md border-l border-slate-800" onClick={e => e.stopPropagation()}>
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
          {errorBanner && (
            <div className="bg-red-500 text-white p-2 mb-4 rounded flex items-center gap-2 text-sm">
                <SafeIcon icon={FiAlertTriangle} />
                {errorBanner}
            </div>
          )}
          {loading && approvals.length === 0 ? (

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
                    {processingId === approval.id ? (
                        <div className="text-sm text-slate-400 flex items-center gap-2">
                           <span className="animate-spin inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full"></span>
                           Processing...
                        </div>
                    ) : (
                        <>
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
                        </>
                    )}
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
