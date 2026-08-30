import { useQuery } from '@tanstack/react-query'
import {
  listDecisions,
  searchDecisions,
  getDecisionDetail,
} from '@/api/decisions'
import { QUERY_KEYS } from '@/lib/constants'

// 决策列表
export function useDecisions(
  page = 1,
  pageSize = 20,
  meetingId?: string,
) {
  return useQuery({
    queryKey: QUERY_KEYS.decisionList(page, pageSize, meetingId),
    queryFn: () => listDecisions(page, pageSize, meetingId),
  })
}

// 决策搜索
export function useSearchDecisions(query: string, enabled = true) {
  return useQuery({
    queryKey: QUERY_KEYS.decisionSearch(query),
    queryFn: () => searchDecisions(query, 10),
    enabled: enabled && query.trim().length > 0,
  })
}

// 决策详情
export function useDecisionDetail(decisionId: string | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.decision(decisionId || ''),
    queryFn: () => getDecisionDetail(decisionId!),
    enabled: !!decisionId,
  })
}
