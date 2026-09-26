import React from 'react';
import { FiShield } from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';
import { supabase } from '../lib/supabase';

export default function InlineApprovalCard({ approvalId, department, title, summary, initialStatus = 'Pending' }) {
  const [status, setStatus] = React.useState(initialStatus);

  const handleApprove = async () => {
    try {
      const { error } = await supabase.rpc('resolve_hitl_action_rpc', {
        p_action_id: approvalId,
        p_status: 'Approved'
      });
      if (error) throw error;
      setStatus('Approved');
    } catch (err) {
      console.error('Failed to approve action:', err);
    }
  };

  const handleReject = async () => {
    try {
      const { error } = await supabase.rpc('resolve_hitl_action_rpc', {
        p_action_id: approvalId,
        p_status: 'Rejected'
      });
      if (error) throw error;
      setStatus('Rejected');
    } catch (err) {
      console.error('Failed to reject action:', err);
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
      </div>
      {status === 'Pending' ? (
        <div className="approval-actions">
          <button className="review-button" onClick={handleApprove}>Approve & Execute</button>
          <button className="review-button reject" onClick={handleReject}>Reject</button>
        </div>
      ) : (
        <span className="approval-status font-semibold ml-auto">{status}</span>
      )}
    </div>
  );
}
