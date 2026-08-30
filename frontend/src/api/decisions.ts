import { apiClient } from './client'
import type {
  DecisionListItem,
  DecisionDetail,
  DecisionSearchResponse,
  PaginatedResponse,
} from '@/types'

// 决策列表（分页 + 可选按 meeting 筛选）
export async function listDecisions(
  page = 1,
  pageSize = 20,
  meetingId?: string,
): Promise<PaginatedResponse<DecisionListItem>> {
  return apiClient
    .get('decisions', {
      searchParams: meetingId
        ? { page, page_size: pageSize, meeting_id: meetingId }
        : { page, page_size: pageSize },
    })
    .json()
}

// 决策语义搜索
export async function searchDecisions(
  query: string,
  topK = 5,
): Promise<DecisionSearchResponse> {
  return apiClient
    .get('decisions/search', {
      searchParams: { q: query, top_k: topK },
    })
    .json()
}

// 决策详情（含 options + 关联决策）
export async function getDecisionDetail(
  decisionId: string,
): Promise<DecisionDetail> {
  return apiClient.get(`decisions/${decisionId}`).json()
}
