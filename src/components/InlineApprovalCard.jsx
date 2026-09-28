import React from 'react';
import { FiShield } from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';
import { supabase } from '../lib/supabase';
import { tunnelRegistry } from '../services/agentTunnels';
import { sendActionResolution } from '../services/bridgeClient';

export default function InlineApprovalCard({ approvalId, department, title, summary, initialStatus = 'Pending' }) {
    const [status, setStatus] = React.useState(initialStatus);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const isDispatchingRef = React.useRef(false);
  const [errorBanner, setErrorBanner] = React.useState(null);

  const dispatchToTunnel = async (resolvedStatus) => {
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



  const handleApprove = async () => {
    if (isDispatchingRef.current) return;
    isDispatchingRef.current = true;
    setIsProcessing(true);
    setErrorBanner(null);
    const previousStatus = status;
    setStatus('Approved'); // Optimistic
    try {
      const { error } = await supabase.rpc('resolve_hitl_action_rpc', {
        p_action_id: approvalId,
        p_status: 'Approved'
      });
      if (error) throw error;

      await supabase.from('action_approvals_log').insert([{
        action_id: approvalId,
        department: department,
        status: 'Approved',
        executed_at: new Date().toISOString()
      }]);

      await dispatchToTunnel('Approved');
    } catch (err) {
      console.error('Failed to approve action:', err);
      setStatus(previousStatus); // Revert
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
    const previousStatus = status;
    setStatus('Rejected'); // Optimistic
    try {
      const { error } = await supabase.rpc('resolve_hitl_action_rpc', {
        p_action_id: approvalId,
        p_status: 'Rejected'
      });
      if (error) throw error;

      await supabase.from('action_approvals_log').insert([{
        action_id: approvalId,
        department: department,
        status: 'Rejected',
        executed_at: new Date().toISOString()
      }]);

      await dispatchToTunnel('Rejected');
    } catch (err) {
      console.error('Failed to reject action:', err);
      setStatus(previousStatus); // Revert
      setErrorBanner('Failed to reject.');
    } finally {
      setIsProcessing(false);
      isDispatchingRef.current = false;
    }
  };


  return (
    <div className={`approval-card inline-card bg-slate-900/80 backdrop-blur-md border border-slate-800 ${status === 'Approved' ? 'approved' : status === 'Rejected' ? 'rejected' : ''}`}>
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
