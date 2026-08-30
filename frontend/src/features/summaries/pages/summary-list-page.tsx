import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { FileText, Sparkles, Loader2, AlertCircle, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import Pagination from '@/components/ui/pagination'
import { useSummaries } from '../hooks/use-summaries'
import { formatDateTime } from '@/lib/utils'
import type { SummaryListItem } from '@/types'

const PAGE_SIZE_OPTIONS = [20, 50, 100]

export default function SummaryListPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const page = Math.max(0, Number(searchParams.get('page')) || 0)
  const rawPageSize = Number(searchParams.get('pageSize'))
  const pageSize = PAGE_SIZE_OPTIONS.includes(rawPageSize) ? rawPageSize : 20
  const searchKey = (searchParams.get('q') ?? '').trim()
  const status = searchParams.get('status') ?? ''
  const startDate = searchParams.get('startDate') ?? ''
  const endDate = searchParams.get('endDate') ?? ''
  const [query, setQuery] = useState(searchKey)
  const { data: listData, isLoading } = useSummaries(
    page + 1,
    pageSize,
    searchKey || undefined,
    status || undefined,
    startDate || undefined,
    endDate || undefined,
  )
  const navigate = useNavigate()
  const summaries = listData?.items || []

  const updateParams = (next: {
    page?: number
    pageSize?: number
    q?: string
    status?: string
    startDate?: string
    endDate?: string
  }) => {
    const params = new URLSearchParams(searchParams)
    if (next.page !== undefined) params.set('page', String(next.page))
    if (next.pageSize !== undefined) params.set('pageSize', String(next.pageSize))
    if (next.q !== undefined) {
      if (next.q) params.set('q', next.q)
      else params.delete('q')
    }
    if (next.status !== undefined) {
      if (next.status) params.set('status', next.status)
      else params.delete('status')
    }
    if (next.startDate !== undefined) {
      if (next.startDate) params.set('startDate', next.startDate)
      else params.delete('startDate')
    }
    if (next.endDate !== undefined) {
      if (next.endDate) params.set('endDate', next.endDate)
      else params.delete('endDate')
    }
    setSearchParams(params)
  }

  const clearDates = () => {
    updateParams({ startDate: '', endDate: '', page: 0 })
  }

  const handleSearch = () => {
    updateParams({ q: query.trim(), page: 0 })
  }

  const handleClearSearch = () => {
    setQuery('')
    updateParams({ q: '', page: 0 })
  }

  return (
    <div className="space-y-6">
      {/* 标题栏 */}
      <div>
        <h1 className="text-2xl font-bold">会议纪要</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          查看所有 AI 生成的会议纪要
        </p>
      </div>

      {/* 搜索 + 筛选 */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="搜索纪要内容或会议标题"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSearch()
          }}
          className="max-w-md"
        />
        <Button onClick={handleSearch}>
          <Search className="h-4 w-4" />
          搜索
        </Button>
        {searchKey && (
          <Button variant="ghost" onClick={handleClearSearch}>
            <X className="h-4 w-4" />
            清除
          </Button>
        )}
        <select
          value={status}
          onChange={(e) => updateParams({ status: e.target.value || undefined, page: 0 })}
          className="h-10 rounded-md border border-input bg-background px-2 text-sm text-foreground"
        >
          <option value="">全部状态</option>
          <option value="completed">已完成</option>
          <option value="generating">生成中</option>
          <option value="failed">失败</option>
        </select>
      </div>

      {/* 日期范围筛选 */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">创建日期</span>
        <Input
          type="date"
          value={startDate}
          onChange={(e) => updateParams({ startDate: e.target.value || undefined, page: 0 })}
          className="w-auto"
        />
        <span className="text-sm text-muted-foreground">至</span>
        <Input
          type="date"
          value={endDate}
          onChange={(e) => updateParams({ endDate: e.target.value || undefined, page: 0 })}
          className="w-auto"
        />
        {(startDate || endDate) && (
          <Button variant="ghost" onClick={clearDates}>
            <X className="h-4 w-4" />
            清除日期
          </Button>
        )}
      </div>

      {/* 纪要列表 */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      ) : summaries.length > 0 ? (
        <>
          {searchKey && (
            <p className="text-sm text-muted-foreground">
              搜索 “{searchKey}”，共 {listData?.total ?? 0} 条结果
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {summaries.map((item) => (
              <SummaryCard
                key={item.id}
                item={item}
                onClick={() => navigate(`/summaries/${item.meeting_id}`)}
              />
            ))}
          </div>
          {listData?.total && listData.total > pageSize && (
            <Pagination
              currentPage={page}
              totalCount={listData.total}
              pageSize={pageSize}
              onPageChange={(p) => updateParams({ page: p })}
              onPageSizeChange={(size) => updateParams({ page: 0, pageSize: size })}
            />
          )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <FileText className="h-12 w-12 opacity-30" />
          {searchKey || status || startDate || endDate ? (
            <>
              <p className="mt-3 text-sm font-medium">未找到匹配的会议纪要</p>
              <p className="mt-1 text-xs">试试调整关键词、状态或日期范围</p>
            </>
          ) : (
            <>
              <p className="mt-3 text-sm font-medium">暂无会议纪要</p>
              <p className="mt-1 text-xs">在会议详情页点击「生成纪要」按钮即可创建</p>
              <Button variant="outline" onClick={() => navigate('/')} className="mt-4">
                前往会议列表
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

interface SummaryCardProps {
  item: SummaryListItem
  onClick: () => void
}

function SummaryCard({ item, onClick }: SummaryCardProps) {
  const statusBadge = (() => {
    switch (item.status) {
      case 'completed':
        return <Badge variant="success">已完成</Badge>
      case 'generating':
        return (
          <Badge variant="info">
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            生成中
          </Badge>
        )
      case 'failed':
        return (
          <Badge variant="destructive">
            <AlertCircle className="mr-1 h-3 w-3" />
            失败
          </Badge>
        )
      default:
        return <Badge variant="secondary">{item.status}</Badge>
    }
  })()

  return (
    <Card
      className="cursor-pointer transition-shadow hover:shadow-md"
      onClick={onClick}
    >
      <CardContent className="p-5">
        <div className="mb-2 flex items-start justify-between gap-2">
          <h3 className="line-clamp-1 text-sm font-semibold">
            {item.meeting_title}
          </h3>
          {statusBadge}
        </div>
        <p className="line-clamp-3 text-sm text-muted-foreground">
          {item.content || '暂无内容'}
        </p>
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Sparkles className="h-3 w-3" />
          <span>{formatDateTime(item.created_at)}</span>
        </div>
      </CardContent>
    </Card>
  )
}
