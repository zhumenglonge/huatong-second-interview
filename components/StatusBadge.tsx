import type { TaskStatus } from '@/lib/types';

const LABEL: Record<TaskStatus, string> = {
  queued: '排队中',
  running: '执行中',
  waiting: '等待澄清',
  success: '成功',
  failed: '失败',
  cancelled: '已取消',
};

export function StatusBadge({ status }: { status: TaskStatus | null }) {
  if (!status) return null;
  return <span className={`badge ${status}`}>{LABEL[status]}</span>;
}
