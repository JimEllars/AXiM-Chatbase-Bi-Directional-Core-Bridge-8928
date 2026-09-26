const STORAGE_KEY = 'axim.core.bridge.state';

const defaultState = {
  selectedAgent: 'cfo',
  conversations: {},
  approvals: [
    {
      id: 'approval-budget-001',
      title: 'Budget adjustment proposal',
      department: 'CFO',
      detail: 'Requested 2 minutes ago',
      status: 'Pending'
    },
    {
      id: 'approval-vendor-002',
      title: 'Vendor access change',
      department: 'COO',
      detail: 'Requested 18 minutes ago',
      status: 'Pending'
    },
    {
      id: 'approval-risk-003',
      title: 'Risk review request',
      department: 'CEO',
      detail: 'Requested 31 minutes ago',
      status: 'Pending'
    }
  ],
  events: [
    {
      id: 'event-001',
      time: '09:42:18',
      title: 'Tool request intercepted',
      detail: 'cfo · propose_action',
      status: 'pending'
    },
    {
      id: 'event-002',
      time: '09:41:52',
      title: 'Conversation mirrored',
      detail: 'cto · thread_7b91',
      status: 'success'
    },
    {
      id: 'event-003',
      time: '09:40:07',
      title: 'Permission evaluated',
      detail: 'operator → cfo',
      status: 'success'
    },
    {
      id: 'event-004',
      time: '09:38:44',
      title: 'Agent response received',
      detail: 'ceo · 842 credits',
      status: 'success'
    }
  ]
};

export const agents = [
  {
    key: 'ceo',
    name: 'AI CEO',
    role: 'Executive strategy',
    id: 'fViIyS2-64jXMyakjf70T',
    level: 'admin',
    color: '#8b5cf6',
    status: 'online'
  },
  {
    key: 'cfo',
    name: 'AI CFO',
    role: 'Finance & approvals',
    id: 'NHjryFStm6hn2kg6q7KgN',
    level: 'operator',
    color: '#14b8a6',
    status: 'online'
  },
  {
    key: 'cto',
    name: 'AI CTO',
    role: 'Technology & systems',
    id: 'CgplD95DZW5tnXRPEGV2A',
    level: 'viewer',
    color: '#3b82f6',
    status: 'online'
  },
  {
    key: 'coo',
    name: 'AI COO',
    role: 'Operations & delivery',
    id: '7biTg1Hu6DMWXUpTWfCLu',
    level: 'operator',
    color: '#f59e0b',
    status: 'online'
  },
  {
    key: 'legal',
    name: 'AI Legal',
    role: 'Risk & compliance',
    id: 'ioJLtMqvhqx69Mokhad64',
    level: 'viewer',
    color: '#ec4899',
    status: 'standby'
  }
];

export const initialMessages = [
  {
    from: 'system',
    text: 'Bridge session initialized. Select a departmental agent to begin.'
  },
  {
    from: 'agent',
    text: 'I am ready to route your request through the AXiM Core Gateway.'
  }
];

function readState() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved ? { ...defaultState, ...JSON.parse(saved) } : defaultState;
  } catch {
    return defaultState;
  }
}

function writeState(state) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    return state;
  }
  return state;
}

export function loadBridgeState() {
  return readState();
}

export function saveBridgeState(state) {
  return writeState(state);
}

export function getAgent(key) {
  return agents.find((agent) => agent.key === key) || agents[1];
}

export function getConversation(state, agentKey) {
  return state.conversations[agentKey] || initialMessages;
}

export function createLocalReply(agent, text) {
  return `Request received by ${agent.name}. This local bridge preview recorded your message: “${text}”. Connect a backend to route it through Chatbase.`;
}

export function appendConversation(state, agentKey, text) {
  const agent = getAgent(agentKey);
  const current = getConversation(state, agentKey);
  const next = {
    ...state,
    conversations: {
      ...state.conversations,
      [agentKey]: [
        ...current,
        { from: 'user', text },
        { from: 'agent', text: createLocalReply(agent, text) }
      ]
    },
    events: [
      {
        id: `event-${Date.now()}`,
        time: new Date().toLocaleTimeString([], { hour12: false }),
        title: 'Local message recorded',
        detail: `${agentKey} · backend unavailable`,
        status: 'pending'
      },
      ...state.events
    ].slice(0, 8)
  };
  return writeState(next);
}

export function resetConversation(state, agentKey) {
  const next = {
    ...state,
    conversations: {
      ...state.conversations,
      [agentKey]: initialMessages
    }
  };
  return writeState(next);
}

export function updateApproval(state, approvalId, status) {
  const approval = state.approvals.find((item) => item.id === approvalId);
  if (!approval) return state;

  const next = {
    ...state,
    approvals: state.approvals.map((item) =>
      item.id === approvalId ? { ...item, status } : item
    ),
    events: [
      {
        id: `event-${Date.now()}`,
        time: new Date().toLocaleTimeString([], { hour12: false }),
        title: `Approval ${status.toLowerCase()}`,
        detail: `${approval.department} · ${approval.title}`,
        status: status === 'Approved' ? 'success' : 'pending'
      },
      ...state.events
    ].slice(0, 8)
  };
  return writeState(next);
}