import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CalendarDays, Plus, Users, Clock, FileAudio, Trash2, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import Pagination from '@/components/ui/pagination'
import { MeetingStatusBadge } from '../components/meeting-status-badge'
import { CreateMeetingDialog } from '../components/create-meeting-dialog'
import { useMeetings, useDeleteMeeting } from '../hooks/use-meetings'
import { formatDateTime } from '@/lib/utils'
import type { Meeting } from '@/types'

interface MeetingCardProps {
  meeting: Meeting
  onClick: () => void
  onDelete: () => void
  isDeleting: boolean
}

interface EmptyStateProps {
  onCreate: () => void
  hasFilter?: boolean
}

const PAGE_SIZE_OPTIONS = [20, 50, 100]

export default function MeetingListPage() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const page = Math.max(0, Number(searchParams.get('page')) || 0)
  const rawPageSize = Number(searchParams.get('pageSize'))
  const pageSize = PAGE_SIZE_OPTIONS.includes(rawPageSize) ? rawPageSize : 20
  const searchKey = (searchParams.get('q') ?? '').trim()
  const status = searchParams.get('status') ?? ''
  const startDate = searchParams.get('startDate') ?? ''
  const endDate = searchParams.get('endDate') ?? ''
  const [query, setQuery] = useState(searchKey)
  const { data: listData, isLoading } = useMeetings(
    page + 1,
    pageSize,
    searchKey || undefined,
    status || undefined,
    startDate || undefined,
    endDate || undefined,
  )
  const deleteMeeting = useDeleteMeeting()
  const navigate = useNavigate()
  const meetings = listData?.items || []

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

  const handleDelete = async (meeting: Meeting) => {
    if (!confirm(`确定删除会议「${meeting.title}」吗？\n关联的转写记录和纪要也将被删除。`)) return
    setDeleteId(meeting.id)
    try {
      await deleteMeeting.mutateAsync(meeting.id)
    } finally {
      setDeleteId(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* 标题栏 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">会议管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">管理和查看所有会议记录</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          新建会议
        </Button>
      </div>

      {/* 搜索 + 筛选 */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="搜索会议标题或描述"
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
          <option value="awaiting_upload">待上传录音</option>
          <option value="pending">待转写</option>
          <option value="transcribing">转写中</option>
          <option value="processed">已完成</option>
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

      {/* 会议列表 */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : meetings.length > 0 ? (
        <>
          {searchKey && (
            <p className="text-sm text-muted-foreground">
              搜索 “{searchKey}”，共 {listData?.total ?? 0} 条结果
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {meetings.map((meeting) => (
              <MeetingCard
                key={meeting.id}
                meeting={meeting}
                onClick={() => navigate(`/meetings/${meeting.id}`)}
                onDelete={() => handleDelete(meeting)}
                isDeleting={deleteId === meeting.id}
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
        <EmptyState
          onCreate={() => setDialogOpen(true)}
          hasFilter={!!(searchKey || status || startDate || endDate)}
        />
      )}

      {/* 新建会议对话框 */}
      <CreateMeetingDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </div>
  )
}

function MeetingCard({ meeting, onClick, onDelete, isDeleting }: MeetingCardProps) {
  return (
    <Card className="group cursor-pointer transition-shadow hover:shadow-md" onClick={onClick}>
      <CardContent className="p-5">
        <div className="mb-3 flex items-start justify-between">
          <h3 className="line-clamp-1 font-semibold">{meeting.title}</h3>
          <div className="flex items-center gap-1">
            <MeetingStatusBadge status={meeting.status} />
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
              disabled={isDeleting}
              onClick={(e) => {
                e.stopPropagation()
                onDelete()
              }}
            >
              <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
            </Button>
          </div>
        </div>

        {meeting.description && (
          <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">
            {meeting.description}
          </p>
        )}

        <div className="space-y-1.5 text-xs text-muted-foreground">
          {meeting.start_time && (
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              <span>{formatDateTime(meeting.start_time)}</span>
            </div>
          )}
          {meeting.participants && meeting.participants.length > 0 && (
            <div className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              <span>{meeting.participants.join('、')}</span>
            </div>
          )}
          {meeting.audio_url && (
            <div className="flex items-center gap-1.5">
              <FileAudio className="h-3.5 w-3.5" />
              <span>已上传录音</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function EmptyState({ onCreate, hasFilter }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-20">
      <CalendarDays className="h-12 w-12 text-muted-foreground/50" />
      {hasFilter ? (
        <>
          <p className="mt-4 text-lg font-medium">未找到匹配的会议</p>
          <p className="mt-1 text-sm text-muted-foreground">试试调整关键词、状态或日期范围</p>
        </>
      ) : (
        <>
          <p className="mt-4 text-lg font-medium">暂无会议记录</p>
          <p className="mt-1 text-sm text-muted-foreground">创建第一个会议并上传录音开始使用</p>
          <Button className="mt-4" onClick={onCreate}>
            <Plus className="h-4 w-4" />
            新建会议
          </Button>
        </>
      )}
    </div>
  )
}
