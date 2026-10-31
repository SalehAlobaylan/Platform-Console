'use client';

import { useQuery } from '@tanstack/react-query';
import { cmsClient } from '@/lib/api/client';
import { operatorInboxSchema } from '@/lib/operator/schemas';

export function OperatorActivityBadge({ locale }: { locale: 'en' | 'ar' }) {
  const inbox = useQuery({
    queryKey: ['operator', 'inbox-summary'],
    queryFn: async () =>
      operatorInboxSchema.parse(
        await cmsClient.get<unknown>('/admin/operator/inbox', { limit: 1 })
      ),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
  const unread = inbox.data?.unread_count ?? 0;
  if (!unread) return null;
  return (
    <span
      className="absolute end-1 top-1 size-1.5 rounded-full bg-info text-[10px] leading-none text-info-foreground md:static md:ms-1.5 md:h-auto md:w-auto md:px-1.5 md:py-0.5"
      aria-label={
        locale === 'ar'
          ? `${unread} نتائج غير مقروءة`
          : `${unread} unread results`
      }
    >
      <span className="hidden md:inline">{unread > 99 ? '99+' : unread}</span>
    </span>
  );
}
