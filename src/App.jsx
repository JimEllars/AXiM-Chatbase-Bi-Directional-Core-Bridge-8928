import React, { useMemo, useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { sendActionResolution } from './services/bridgeClient';
import { tunnelRegistry } from './services/agentTunnels';
import {
  FiActivity,
  FiArrowUpRight,
  FiCheck,
  FiChevronDown,
  FiClock,
  FiCpu,
  FiDatabase,
  FiLock,
  FiMessageSquare,
  FiPlus,
  FiRefreshCw,
  FiSend,
  FiShield,
  FiSliders,
  FiZap
} from 'react-icons/fi';
import SafeIcon from './common/SafeIcon';
import { agents, getAgent, getConversation, loadBridgeState, resetConversation, updateApproval } from './services/localBridge';
import './App.css';
import { getPassportSession } from './lib/auth';
import { sendChatMessage } from './services/bridgeClient';
import InlineApprovalCard from './components/InlineApprovalCard';
import TelemetryBar from './components/TelemetryBar';
import PendingApprovalsDrawer from './components/PendingApprovalsDrawer';

function Sidebar({ active, onNavigate, pendingCount }) {
  const items = [
    ['overview', FiActivity, 'Overview'],
    ['conversations', FiMessageSquare, 'Conversations'],
    ['approvals', FiShield, 'Approval queue'],
    ['agents', FiCpu, 'Agent registry'],
    ['ledger', FiDatabase, 'Core ledger']
  ];

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark"><SafeIcon icon={FiZap} /></div>
        <div><strong>AXiM</strong><span>CORE BRIDGE</span></div>
      </div>
      <div className="workspace">
        <span className="eyebrow">Workspace</span>
        <button className="workspace-select">
          AXiM Operations <SafeIcon icon={FiChevronDown} />
        </button>
      </div>
      <nav>
        <span className="eyebrow nav-label">Control plane</span>
        {items.map(([id, Icon, label]) => (
          <button
            className={`nav-item ${active === id ? 'active' : ''}`}
            onClick={() => onNavigate(id)}
            key={id}
          >
            <SafeIcon icon={Icon} />
            <span>{label}</span>
            {id === 'approvals' && pendingCount > 0 && (
              <b className="nav-badge">{pendingCount}</b>
            )}
          </button>
        ))}
      </nav>
      <div className="sidebar-footer">
        <div className="security-chip">
          <SafeIcon icon={FiLock} />
          <div><strong>Gateway secured</strong><span>HITL interlock active</span></div>
        </div>
        <div className="user-row">
          <div className="avatar">JE</div>
          <div><strong>Jim Ellars</strong><span>System operator</span></div>
          <SafeIcon icon={FiSliders} />
        </div>
      </div>
    </aside>
  );
}

function Topbar({ active }) {
  const title = active === 'overview' ? 'Overview' : active.replace('-', ' ');
  return (
    <header className="topbar">
      <div><span className="breadcrumb">Control plane / </span><strong>{title}</strong></div>
      <div className="top-actions">
        <span className="live-dot" /> Local bridge active
        <button className="icon-button"><SafeIcon icon={FiSliders} /></button>
      </div>
    </header>
  );
}

function StatCard({ icon, label, value, detail, tone }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${tone}`}><SafeIcon icon={icon} /></div>
      <div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>
    </div>
  );
}

function AgentCard({ agent, selected, onSelect }) {
  return (
    <button className={`agent-card ${selected ? 'selected' : ''}`} onClick={onSelect}>
      <div className="agent-card-top">
        <div className="agent-avatar" style={{ background: `${agent.color}22`, color: agent.color }}>
          <SafeIcon icon={FiCpu} />
        </div>
        <span className={`status ${agent.status}`}>{agent.status}</span>
      </div>
      <strong>{agent.name}</strong>
      <span>{agent.role}</span>
      <div className="agent-meta">
        <em>{agent.level}</em><small>{agent.id.slice(0, 8)}...</small>
      </div>
    </button>
  );
}

function BridgeChat({ agent, messages, onSend, onReset }) {
  const [input, setInput] = useState('');

  const submit = (event) => {
    event.preventDefault();
    if (!input.trim()) return;
    onSend(input.trim());
    setInput('');
  };

  return (
    <section className="panel chat-panel">
      <div className="panel-heading">
        <div><span className="eyebrow">Bi-directional session</span><h2>Gateway conversation</h2></div>
        <span className="session-pill"><i /> Thread active</span>
      </div>
      <div className="chat-context">
        <div className="mini-agent" style={{ color: agent.color }}><SafeIcon icon={FiCpu} /></div>
        <div><strong>{agent.name}</strong><span>local bridge · {agent.level} access</span></div>
        <button className="icon-button" onClick={onReset} aria-label="Reset conversation">
          <SafeIcon icon={FiRefreshCw} />
        </button>
      </div>
      <div className="messages">
        {messages.map((message, index) => (
          <div className={`message ${message.from}`} key={`${message.text}-${index}`}>
            <div className="message-label">
              {message.from === 'agent' ? agent.name : message.from === 'system' ? 'Gateway' : 'You'}
            </div>
            {message.isApproval ? (
              <InlineApprovalCard
                approvalId={message.approvalData.approval_id}
                department={agent.key.toUpperCase()}
                title={message.approvalData.action || 'Action Required'}
                summary={message.approvalData.parameters ? JSON.stringify(message.approvalData.parameters) : ''}
              />
            ) : (
              <p>{message.text}</p>
            )}
          </div>
        ))}
      </div>
      <form className="composer" onSubmit={submit}>
        <input value={input} onChange={(event) => setInput(event.target.value)} placeholder={`Message ${agent.name}...`} />
        <button aria-label="Send message"><SafeIcon icon={FiSend} /></button>
      </form>
      <div className="composer-note">
        <SafeIcon icon={FiLock} /> Stored locally · live API credentials remain server-side
      </div>
    </section>
  );
}

function ActivityFeed({ events }) {
  return (
    <section className="panel activity-panel">
      <div className="panel-heading">
        <div><span className="eyebrow">Live telemetry</span><h2>Gateway activity</h2></div>
        <span className="text-button">Local ledger <SafeIcon icon={FiArrowUpRight} /></span>
      </div>
      <div className="activity-list">
        {events.map((event) => (
          <div className="activity-row" key={event.id}>
            <div className={`activity-icon ${event.status}`}>
              <SafeIcon icon={event.status === 'pending' ? FiClock : FiCheck} />
            </div>
            <div><strong>{event.title}</strong><span>{event.detail}</span></div>
            <time>{event.time}</time>
          </div>
        ))}
      </div>
    </section>
  );
}

function ApprovalQueue({ approvals, onUpdate, tab, setTab }) {
  const filteredApprovals = tab ? approvals.filter(a => (a.status || 'Pending') === tab) : approvals;
  return (
    <section className="panel approval-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Human-in-the-loop</span>
          <h2>Approval queue <b className="count">{approvals.filter((item) => (item.status || 'Pending') === 'Pending').length}</b></h2>
        </div>
        {setTab && (
          <div className="flex gap-2">
            <button className={`text-sm px-2 py-1 rounded ${tab === 'Pending' ? 'bg-slate-700 text-white' : 'text-slate-400'}`} onClick={() => setTab('Pending')}>Pending</button>
            <button className={`text-sm px-2 py-1 rounded ${tab === 'Approved' ? 'bg-slate-700 text-white' : 'text-slate-400'}`} onClick={() => setTab('Approved')}>Approved</button>
            <button className={`text-sm px-2 py-1 rounded ${tab === 'Rejected' ? 'bg-slate-700 text-white' : 'text-slate-400'}`} onClick={() => setTab('Rejected')}>Rejected</button>
          </div>
        )}
      </div>
      {filteredApprovals.length === 0 ? (
        <div className="text-slate-400 p-4 text-center">No {tab} actions</div>
      ) : filteredApprovals.map((approval) => (
        <div className="approval-card" key={approval.id}>
          <div className={`approval-icon ${approval.status === 'Approved' ? 'amber' : ''}`}><SafeIcon icon={FiShield} /></div>
          <div><strong>{approval.title || approval.action}</strong><span>{approval.department || 'SYSTEM'} · {approval.detail || approval.justification}</span></div>
          {(approval.status || 'Pending') === 'Pending' ? (
            <div className="approval-actions">
              <button className="review-button" onClick={() => onUpdate(approval.id, approval.department || 'SYSTEM', 'Approved')}>Approve & Execute</button>
              <button className="review-button reject" onClick={() => onUpdate(approval.id, approval.department || 'SYSTEM', 'Rejected')}>Reject</button>
            </div>
          ) : <span className="approval-status">{approval.status}</span>}
        </div>
      ))}
    </section>
  );
}

function Registry({ selectedKey, onSelect }) {
  return (
    <section className="section-block">
      <div className="section-title">
        <div><span className="eyebrow">Department matrix</span><h2>Agent registry</h2></div>
        <span className="text-button">Local registry <SafeIcon icon={FiArrowUpRight} /></span>
      </div>
      <div className="agents-grid">
        {agents.map((agent) => (
          <AgentCard agent={agent} selected={agent.key === selectedKey} onSelect={() => onSelect(agent.key)} key={agent.key} />
        ))}
      </div>
    </section>
  );
}

function App() {
  React.useEffect(() => {
    const session = getPassportSession();
    if (!session || !session.access_token) {
      // Just fallback, don't redirect
      console.warn('Using local guest session fallback.');
    }
  }, []);

  const [active, setActive] = useState('overview');
  const [state, setState] = useState(loadBridgeState);
  const [isApprovalsDrawerOpen, setApprovalsDrawerOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [globalApprovals, setGlobalApprovals] = useState([]);
  const [ledgerEvents, setLedgerEvents] = useState([]);
  const [approvalTab, setApprovalTab] = useState('Pending');
  const [tunnelStatus, setTunnelStatus] = useState('disconnected');
  const [latency, setLatency] = useState(0);
  const [sessionBanner, setSessionBanner] = useState(null);

  const handleSessionEvent = (e) => {
    if (e.detail.status === 'lost') {
      setSessionBanner('Session connectivity lost. Retrying...');
    } else {
      setSessionBanner(null);
    }
  };

  useEffect(() => {
    window.addEventListener('axim.session.event', handleSessionEvent);

    // Fetch pending count periodically
    const fetchPendingCount = async () => {
      try {
        const { data, error } = await supabase.rpc('get_pending_approvals');
        if (!error && data) {
           setPendingCount(data.filter(a => a.status === 'Pending').length);
           setGlobalApprovals(data);
        }
      } catch (err) {
        // ignore
      }
    };

    const fetchLedgerEvents = async () => {
      try {
        const { data, error } = await supabase.from('hitl_audit_logs')
          .select('id, action, action_required, status, target_department, timestamp')
          .order('timestamp', { ascending: false })
          .limit(50);
        if (!error && data) {
          setLedgerEvents(data.map(d => ({
             id: d.id,
             title: d.action || 'System Action',
             detail: d.action_required ? 'Approval Required' : 'Auto-executed',
             time: new Date(d.timestamp).toLocaleTimeString(),
             status: d.status.toLowerCase() === 'pending' ? 'pending' : 'approved'
          })));
        }
      } catch (err) { /* ignore */ }
    };

    fetchPendingCount();
    fetchLedgerEvents();
    const intervalId = setInterval(() => { fetchPendingCount(); fetchLedgerEvents(); }, 10000);

    const updateTelemetry = () => {
      const tunnels = tunnelRegistry.getAllTunnels();
      if (tunnels.length > 0) {
        let totalLatency = 0;
        let validCount = 0;
        let worstStatus = 'connected';

        tunnels.forEach(t => {
          if (t.latency > 0) {
            totalLatency += t.latency;
            validCount++;
          }
          if (t.status === 'disconnected') worstStatus = 'disconnected';
          else if (t.status === 'degraded' && worstStatus !== 'disconnected') worstStatus = 'degraded';
          else if (t.status === 'polling' && worstStatus === 'connected') worstStatus = 'polling';
        });

        let avgLatency = validCount > 0 ? Math.floor(totalLatency / validCount) : 0;
        setLatency(avgLatency);

        if (avgLatency >= 120 && avgLatency <= 350) worstStatus = 'degraded';
        else if (avgLatency > 350) worstStatus = 'disconnected';

        setTunnelStatus(worstStatus);
      }
    };
    const telemetryIntervalId = setInterval(updateTelemetry, 1000);
    updateTelemetry();


    const channel = supabase
      .channel('public:hitl_audit_logs_main')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hitl_audit_logs' }, () => {
        fetchPendingCount();
        fetchLedgerEvents();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('axim.session.event', handleSessionEvent);
      clearInterval(intervalId);
      clearInterval(telemetryIntervalId);
    };
  }, []);
  const [creditsUsed, setCreditsUsed] = useState(0);
  const agent = useMemo(() => getAgent(state.selectedAgent), [state.selectedAgent]);
  const messages = getConversation(state, agent.key);
  // const oldPendingCount = state.approvals.filter((item) => item.status === 'Pending').length;

  const selectAgent = (key) => {
    setState((current) => ({ ...current, selectedAgent: key }));
    setActive('conversations');
  };

  const sendMessage = async (text) => {
    setState((current) => {
      const currentMessages = getConversation(current, agent.key);
      return {
        ...current,
        conversations: {
          ...current.conversations,
          [agent.key]: [
            ...currentMessages,
            { from: 'user', text }
          ]
        }
      };
    });

    try {
      const convKey = `axim.chatbase.conversation.${agent.key}`;
      const conversationId = sessionStorage.getItem(convKey) || undefined;
      const response = await sendChatMessage({
        appKey: agent.key,
        message: text,
        conversationId
      });

      if (response.conversationId) {
        sessionStorage.setItem(convKey, response.conversationId);
      }

      const edgeCredits = response.credits || response.metadata?.usage?.credits || 1;
      setCreditsUsed(prev => prev + Number(edgeCredits));

      setState((current) => {
        const currentMessages = getConversation(current, agent.key);
        let newMessages = [...currentMessages];

        if (response.state === 'pending_approval' && response.approval_id) {
          newMessages.push({
            from: 'system',
            text: 'Tool call pending approval.',
            isApproval: true,
            approvalData: response
          });
        } else if (response.reply) {
          newMessages.push({ from: 'agent', text: response.reply });
        } else {
           newMessages.push({ from: 'agent', text: response.message || JSON.stringify(response) });
        }

        return {
          ...current,
          conversations: {
            ...current.conversations,
            [agent.key]: newMessages
          }
        };
      });

    } catch (err) {
      setState((current) => {
        const currentMessages = getConversation(current, agent.key);
        return {
          ...current,
          conversations: {
            ...current.conversations,
            [agent.key]: [
              ...currentMessages,
              { from: 'system', text: `Error: ${err.message}` }
            ]
          }
        };
      });
    }
  };

  const resetChat = () => {
    setState((current) => resetConversation(current, agent.key));
  };

  const handleApproval = async (id, department, status) => {
    try {
      const { error } = await supabase.rpc('resolve_hitl_action_rpc', {
        p_action_id: id,
        p_status: status
      });
      if (error) throw error;

      try {
        await supabase.from('hitl_audit_logs').update({ status, resolved_at: new Date().toISOString() }).eq('id', id);
      } catch (e) { /* ignore */ }

      await sendActionResolution({
        actionId: id,
        status,
        timestamp: new Date().toISOString(),
        resolvedBy: 'current_user_or_system'
      });

      // Update local globalApprovals state optimistically
      setGlobalApprovals(prev => prev.map(a => a.id === id ? { ...a, status } : a));
      setPendingCount(prev => Math.max(0, prev - 1));

    } catch (err) {
      console.error('Failed to resolve action:', err);
    }
  };

  const showOverview = active === 'overview';
  const showConversations = active === 'conversations' || showOverview;
  const showApprovals = active === 'approvals' || showOverview;
  const showRegistry = active === 'agents' || showOverview;

  return (
    <div className="app-shell">
      {sessionBanner && <div className="bg-red-500/90 text-white text-center py-2 text-sm font-semibold z-50 relative">{sessionBanner}</div>}
      <Sidebar active={active} onNavigate={setActive} pendingCount={pendingCount} />
      <main className="main-content">
        <TelemetryBar creditsUsed={creditsUsed} conversationId={sessionStorage.getItem(`axim.chatbase.conversation.${agent.key}`)} pendingCount={pendingCount} onOpenApprovals={() => setApprovalsDrawerOpen(true)} />
        <Topbar active={active} tunnelStatus={tunnelStatus} />
        <div className="page-content">
          {agent.key === 'onyx_direct' && (
            <div className="bg-cyan-500/10 border border-cyan-500/40 text-cyan-400 p-4 mb-6 rounded flex items-center gap-3">
              <span className="text-xl">⚡</span>
              <div>
                <strong>Out-of-Band Executive Direct Line</strong>
                <p className="text-sm opacity-80 m-0">Connected to Onyx Mk3 Kernel</p>
              </div>
            </div>
          )}
          <section className="hero">
            <div>
              <span className="eyebrow accent">AXiM CORE · CHATBASE V2</span>
              <h1>Departmental intelligence,<br /><em>under control.</em></h1>
              <p>One authenticated bridge for every C-Suite agent, action, and approval.</p>
            </div>
            <button className="primary-button" onClick={() => setActive('conversations')}>
              <SafeIcon icon={FiPlus} /> New conversation
            </button>
          </section>

          {showOverview && (
            <div className="stats-grid">
              <StatCard icon={FiActivity} label="Gateway status" value={tunnelStatus === 'connected' ? 'Operational' : tunnelStatus === 'degraded' ? 'Degraded' : 'Offline'} detail={`${latency > 0 ? latency + 'ms latency' : 'Core edge uplink'}`} tone={tunnelStatus === 'connected' ? 'green' : tunnelStatus === 'degraded' ? 'amber' : 'red'} />
              <StatCard icon={FiMessageSquare} label="Active threads" value={String(Object.keys(state.conversations).length).padStart(2, '0')} detail="Stored in this browser" tone="purple" />
              <StatCard icon={FiShield} label="Pending approvals" value={String(pendingCount).padStart(2, '0')} detail="Local review queue" tone="amber" />
              <StatCard icon={FiZap} label="Credits used" value={creditsUsed} detail="Active session usage" tone="blue" />
            </div>
          )}

          {showRegistry && <Registry selectedKey={agent.key} onSelect={selectAgent} />}

          {showConversations && (
            <div className="lower-grid">
              <BridgeChat agent={agent} messages={messages} onSend={sendMessage} onReset={resetChat} />
              <div className="side-panels">
                <ActivityFeed events={state.events} />
                {showApprovals && <ApprovalQueue approvals={(globalApprovals.length > 0 ? globalApprovals : state.approvals).slice(0, 2)} onUpdate={handleApproval} />}
              </div>
            </div>
          )}

          {active === 'approvals' && (
            <ApprovalQueue approvals={globalApprovals.length > 0 ? globalApprovals : state.approvals} onUpdate={handleApproval} tab={approvalTab} setTab={setApprovalTab} />
          )}

          {active === 'ledger' && <ActivityFeed events={ledgerEvents.length > 0 ? ledgerEvents : state.events} />}

          <div className="preview-note">
            <SafeIcon icon={FiDatabase} />
            <span><strong>AXiM Core Bridge</strong> · Authenticated edge gateway active with Human-In-The-Loop write protection.</span>
          </div>
        </div>
      </main>
        <PendingApprovalsDrawer isOpen={isApprovalsDrawerOpen} onClose={() => setApprovalsDrawerOpen(false)} />
    </div>
  );
}

export default App;