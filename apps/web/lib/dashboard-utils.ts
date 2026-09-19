import type { DashboardDailyUsage } from './dashboard'

const CHART_BASELINE = 120
const CHART_HEIGHT = 150
const CHART_WIDTH = 320
const CHART_TOP = 12

export function buildAiUsageChartPaths(daily: DashboardDailyUsage[]) {
  const requests = daily.map(item => item.requests)
  const maximum = Math.max(...requests, 0)
  const points = requests.map((value, index) => ({
    x: daily.length > 1 ? (index / (daily.length - 1)) * CHART_WIDTH : CHART_WIDTH / 2,
    y: maximum === 0 ? CHART_BASELINE : CHART_BASELINE - (value / maximum) * (CHART_BASELINE - CHART_TOP)
  }))

  const linePath = maximum === 0
    ? `M0 ${CHART_BASELINE} L${CHART_WIDTH} ${CHART_BASELINE}`
    : points.reduce((path, point, index) => (
      index === 0
        ? `M${point.x} ${point.y}`
        : `${path} C${(points[index - 1].x + point.x) / 2} ${points[index - 1].y} ${(points[index - 1].x + point.x) / 2} ${point.y} ${point.x} ${point.y}`
    ), '')

  return {
    areaPath: `${linePath} L${CHART_WIDTH} ${CHART_HEIGHT} L0 ${CHART_HEIGHT} Z`,
    linePath
  }
}

export function formatCompactNumber(value: number): string {
  if (Math.abs(value) < 1000) return String(value)

  return `${(value / 1000).toFixed(1).replace(/\.0$/, '')}k`
}

export function formatRelativeTime(timestamp: string, now = new Date()): string {
  const date = new Date(timestamp)
  const differenceInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (Number.isNaN(date.getTime()) || differenceInSeconds < 0) return 'Just now'
  if (differenceInSeconds < 60) return 'Just now'
  if (differenceInSeconds < 3600) return `${Math.floor(differenceInSeconds / 60)}m ago`
  if (differenceInSeconds < 86_400) return `${Math.floor(differenceInSeconds / 3600)}h ago`
  if (differenceInSeconds < 172_800) return 'Yesterday'

  return `${Math.floor(differenceInSeconds / 86_400)}d ago`
}
