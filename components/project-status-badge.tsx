import { ProjectStatus } from '@prisma/client';
import { Badge } from '@/components/ui/badge';

const MAP: Record<ProjectStatus, { variant: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline'; label: string }> = {
  PROPOSED:    { variant: 'warning',     label: 'Proposed' },
  IN_PROGRESS: { variant: 'default',     label: 'In progress' },
  SUBMITTED:   { variant: 'secondary',   label: 'Submitted' },
  ACCEPTED:    { variant: 'success',     label: 'Accepted' },
  REJECTED:    { variant: 'destructive', label: 'Rejected' },
  COMPLETED:   { variant: 'success',     label: 'Completed' }
};

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const meta = MAP[status];
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}
