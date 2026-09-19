export interface DashboardDailyUsage {
  date: string
  requests: number
}

export interface DashboardRecentChat {
  id: string
  lastMessageAt: string
  name: null | string
  repoId: number
}

export interface DashboardRecentActivity {
  kind: 'chat_started' | 'docs_ready' | 'repo_cloned' | 'repo_embedded'
  meta: string
  occurredAt: string
  title: string
}

export interface DashboardSummaryResponse {
  aiSessionsThisMonth: number
  aiUsage: {
    daily: DashboardDailyUsage[]
    total: number
  }
  apiEndpoints: null | number
  recentActivity: DashboardRecentActivity[]
  recentChats: DashboardRecentChat[]
  repositories: number
}
