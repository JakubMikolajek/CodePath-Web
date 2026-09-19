import { Injectable, Logger } from '@nestjs/common'
import { and, count, desc, eq, gte, isNotNull, sql } from 'drizzle-orm'

import { env } from '../../config/env'
import { chatHistory, chatSessions, repos } from '../db/schema'
import { DbService } from '../db/services/db.service'
import { QdrantService } from '../qdrant/services/qdrant.service'
import {
  DashboardRecentActivity,
  DashboardSummaryResponse
} from './dto/dashboard-summary.response'

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name)

  constructor(
    private readonly dbService: DbService,
    private readonly qdrantService: QdrantService
  ) { }

  async getSummary(userId: number): Promise<DashboardSummaryResponse> {
    const now = this.now()
    const monthStart = startOfUtcMonth(now)
    const usageStart = startOfUtcDay(addUtcDays(now, -6))
    const usageDate = sql<string>`to_char(date_trunc('day', ${chatHistory.createdAt} at time zone 'UTC'), 'YYYY-MM-DD')`
    const lastMessageAt = sql<string>`coalesce(max(${chatHistory.createdAt}), ${chatSessions.createdAt})`

    const [userRepos, sessionCountRows, usageRows, recentChatRows] = await Promise.all([
      this.dbService.dbClient.select({
        cloneStatus: repos.cloneStatus,
        docsStatus: repos.docsStatus,
        embeddingStatus: repos.embeddingStatus,
        id: repos.id,
        name: repos.name,
        pipelineUpdatedAt: repos.pipelineUpdatedAt
      }).from(repos).where(eq(repos.userId, userId)),
      this.dbService.dbClient.select({ total: count() }).from(chatSessions).where(and(
        eq(chatSessions.userId, userId),
        gte(chatSessions.createdAt, monthStart.toISOString())
      )),
      this.dbService.dbClient.select({
        date: usageDate,
        requests: count()
      }).from(chatHistory).where(and(
        eq(chatHistory.userId, userId),
        eq(chatHistory.role, 'user'),
        gte(chatHistory.createdAt, usageStart.toISOString())
      )).groupBy(usageDate).orderBy(usageDate),
      this.dbService.dbClient.select({
        id: chatSessions.id,
        lastMessageAt,
        name: chatSessions.name,
        repoId: chatSessions.repoId,
        sessionCreatedAt: chatSessions.createdAt
      }).from(chatSessions).leftJoin(chatHistory, and(
        eq(chatHistory.sessionId, chatSessions.id),
        eq(chatHistory.userId, userId)
      )).where(and(
        eq(chatSessions.userId, userId),
        isNotNull(chatSessions.createdAt)
      )).groupBy(
        chatSessions.id,
        chatSessions.name,
        chatSessions.repoId,
        chatSessions.createdAt
      ).orderBy(desc(lastMessageAt)).limit(4)
    ])

    const recentChats = recentChatRows.map(chat => ({
      id: chat.id,
      lastMessageAt: toIso(chat.lastMessageAt),
      name: chat.name,
      repoId: chat.repoId
    }))

    const apiEndpoints = await this.countApiEndpoints(userRepos.map(repo => repo.id))

    return {
      aiSessionsThisMonth: Number(sessionCountRows[0]?.total ?? 0),
      aiUsage: this.mapUsage(usageRows, usageStart),
      apiEndpoints,
      recentActivity: this.recentActivity(userRepos, recentChatRows.map(chat => ({
        name: chat.name,
        occurredAt: toIso(chat.sessionCreatedAt as string),
        repoId: chat.repoId
      }))),
      recentChats,
      repositories: userRepos.length
    }
  }

  private async countApiEndpoints(repoIds: number[]): Promise<null | number> {
    if (repoIds.length === 0) return 0

    try {
      const result = await this.qdrantService.count(env.qdrantEmbeddingsCollectionName, {
        must: [
          { key: 'repo_id', match: { any: repoIds } }
        ],
        must_not: [{ is_empty: { key: 'http_method' } }]
      })

      return Number(result.count)
    } catch (error) {
      this.logger.warn(`Unable to count dashboard API endpoints: ${error instanceof Error ? error.message : String(error)}`)
      return null
    }
  }

  private mapUsage(rows: Array<{ date: string, requests: number }>, start: Date): DashboardSummaryResponse['aiUsage'] {
    const requestsByDate = new Map(rows.map(row => [row.date, Number(row.requests)]))
    const daily = Array.from({ length: 7 }, (_, index) => {
      const date = formatUtcDate(addUtcDays(start, index))

      return { date, requests: requestsByDate.get(date) ?? 0 }
    })

    return {
      daily,
      total: daily.reduce((total, day) => total + day.requests, 0)
    }
  }

  private now(): Date {
    return new Date()
  }

  private recentActivity(
    userRepos: Array<{
      cloneStatus: string
      docsStatus: string
      embeddingStatus: string
      name: string
      pipelineUpdatedAt: null | string
    }>,
    recentChats: Array<{ name: null | string, occurredAt: string, repoId: number }>
  ): DashboardRecentActivity[] {
    const activities: DashboardRecentActivity[] = []

    for (const repo of userRepos) {
      const activity = this.repoActivity(repo)

      if (activity) activities.push(activity)
    }

    for (const chat of recentChats) {
      activities.push({
        kind: 'chat_started',
        meta: 'AI chat session started',
        occurredAt: chat.occurredAt,
        title: chat.name ?? `Chat for repository ${chat.repoId}`
      })
    }

    return activities.sort((left, right) => right.occurredAt.localeCompare(left.occurredAt)).slice(0, 4)
  }

  private repoActivity(repo: {
    cloneStatus: string
    docsStatus: string
    embeddingStatus: string
    name: string
    pipelineUpdatedAt: null | string
  }): DashboardRecentActivity | null {
    if (!repo.pipelineUpdatedAt) return null

    // A repo stores only its latest pipeline timestamp, so one event is derived from the
    // most advanced successful stage: docs ready, then embedded, then cloned.
    if (repo.docsStatus === 'ready') {
      return { kind: 'docs_ready', meta: 'Documentation is ready', occurredAt: toIso(repo.pipelineUpdatedAt), title: repo.name }
    }

    if (repo.embeddingStatus === 'embedded') {
      return { kind: 'repo_embedded', meta: 'Repository embeddings are ready', occurredAt: toIso(repo.pipelineUpdatedAt), title: repo.name }
    }

    if (repo.cloneStatus === 'cloned') {
      return { kind: 'repo_cloned', meta: 'Repository clone completed', occurredAt: toIso(repo.pipelineUpdatedAt), title: repo.name }
    }

    return null
  }
}

function addUtcDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setUTCDate(result.getUTCDate() + days)
  return result
}

function formatUtcDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function startOfUtcMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}

function toIso(value: string): string {
  return new Date(value).toISOString()
}
