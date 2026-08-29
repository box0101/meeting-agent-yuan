import { Badge } from '@/components/ui/badge'
import type { MeetingStatus } from '@/types'

const statusConfig: Record<MeetingStatus, { label: string; variant: 'default' | 'info' | 'success' | 'warning' | 'destructive' }> = {
  awaiting_upload: { label: '待上传录音', variant: 'warning' },
  pending: { label: '待转写', variant: 'warning' },
  transcribing: { label: '转写中', variant: 'info' },
  processed: { label: '已完成', variant: 'success' },
  failed: { label: '失败', variant: 'destructive' },
}

export function MeetingStatusBadge({ status }: { status: MeetingStatus }) {
  const config = statusConfig[status] || statusConfig.pending
  return <Badge variant={config.variant}>{config.label}</Badge>
}
