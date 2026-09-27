import React from 'react';
import { FiShield } from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';
import { supabase } from '../lib/supabase';
import { tunnelRegistry } from '../services/agentTunnels';

export default function InlineApprovalCard({ approvalId, department, title, summary, initialStatus = 'Pending' }) {
    const [status, setStatus] = React.useState(initialStatus);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const isDispatchingRef = React.useRef(false);
  const [errorBanner, setErrorBanner] = React.useState(null);

  const dispatchToTunnel = async (resolvedStatus) => {
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


  const handleApprove = async () => {
    if (isDispatchingRef.current) return;
    isDispatchingRef.current = true;
    setIsProcessing(true);
    setErrorBanner(null);
    try {
      const { error } = await supabase.rpc('resolve_hitl_action_rpc', {
        p_action_id: approvalId,
        p_status: 'Approved'
      });
      if (error) throw error;
      setStatus('Approved');

      await supabase.from('action_approvals_log').insert([{
        action_id: approvalId,
        department: department,
        status: 'Approved',
        executed_at: new Date().toISOString()
      }]);

      await dispatchToTunnel('Approved');
    } catch (err) {
      console.error('Failed to approve action:', err);
      setErrorBanner('Failed to approve.');
    } finally {
      setIsProcessing(false);
      isDispatchingRef.current = false;
    }
  };



  const handleReject = async () => {
    if (isDispatchingRef.current) return;
    isDispatchingRef.current = true;
    setIsProcessing(true);
    setErrorBanner(null);
    try {
      const { error } = await supabase.rpc('resolve_hitl_action_rpc', {
        p_action_id: approvalId,
        p_status: 'Rejected'
      });
      if (error) throw error;
      setStatus('Rejected');

      await supabase.from('action_approvals_log').insert([{
        action_id: approvalId,
        department: department,
        status: 'Rejected',
        executed_at: new Date().toISOString()
      }]);

      await dispatchToTunnel('Rejected');
    } catch (err) {
      console.error('Failed to reject action:', err);
      setErrorBanner('Failed to reject.');
    } finally {
      setIsProcessing(false);
      isDispatchingRef.current = false;
    }
  };


  return (
    <div className={`approval-card inline-card ${status === 'Approved' ? 'approved' : status === 'Rejected' ? 'rejected' : ''}`}>
      <div className={`approval-icon ${status === 'Pending' ? 'amber' : status === 'Approved' ? 'emerald' : 'red'}`}>
        <SafeIcon icon={FiShield} />
      </div>

      <div className="card-content">
        <strong>Action Approval Required &middot; {department}</strong>
        <span>{title}</span>
        {summary && <p className="text-sm mt-1">{summary}</p>}
        {errorBanner && <p className="text-sm mt-1 text-red-500 font-semibold">{errorBanner}</p>}
      </div>
      {status === 'Pending' ? (
        <div className="approval-actions">
          {isProcessing ? (
             <div className="text-sm text-slate-400 flex items-center gap-2 px-4 py-1">
                 <span className="animate-spin inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full"></span>
                 Processing...
             </div>
          ) : (
             <>
                 <button className="review-button" onClick={handleApprove}>Approve & Execute</button>
                 <button className="review-button reject" onClick={handleReject}>Reject</button>
             </>
          )}
        </div>
      ) : (

        <span className="approval-status font-semibold ml-auto">{status}</span>
      )}
    </div>
  );
}
