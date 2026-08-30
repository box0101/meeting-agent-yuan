export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'
export const SSE_BASE_URL = import.meta.env.VITE_SSE_BASE_URL || '/api'

export const QUERY_KEYS = {
  // meetings
  meetings: 'meetings',
  meeting: (id: string) => ['meeting', id] as const,
  transcripts: (meetingId: string) => ['transcripts', meetingId] as const,
  transcriptionStatus: (meetingId: string) => ['transcription-status', meetingId] as const,
  // summaries
  summaries: 'summaries',
  summaryList: (page: number, pageSize: number, q?: string, status?: string, startDate?: string, endDate?: string) => ['summary-list', page, pageSize, q, status, startDate, endDate] as const,
  meetingSummary: (meetingId: string) => ['meeting-summary', meetingId] as const,
  summaryDetail: (meetingId: string) => ['summary-detail', meetingId] as const,
  actionItems: (meetingId: string) => ['action-items', meetingId] as const,
  risks: (meetingId: string) => ['risks', meetingId] as const,
  // chat
  chatSessions: (meetingId: string) => ['chat-sessions', meetingId] as const,
  chatMessages: (sessionId: string) => ['chat-messages', sessionId] as const,
  // knowledge
  knowledge: 'knowledge',
  knowledgeDocuments: (page: number, pageSize: number) => ['knowledge-documents', page, pageSize] as const,
  // agent runs
  agentRuns: 'agent-runs',
  agentRunsList: (params: Record<string, unknown>) => ['agent-runs-list', params] as const,
  agentRun: (id: string) => ['agent-run', id] as const,
  agentRunStats: 'agent-run-stats',
  tools: 'tools',
  // decisions
  decisions: 'decisions',
  decisionList: (page: number, pageSize: number, meetingId?: string) =>
    ['decision-list', page, pageSize, meetingId] as const,
  decision: (id: string) => ['decision', id] as const,
  decisionSearch: (query: string) => ['decision-search', query] as const,
} as const

export const APP_TITLE = '评审决策 Agent'
