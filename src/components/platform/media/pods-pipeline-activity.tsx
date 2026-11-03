'use client';

import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePodsPipelineActivity } from '@/hooks/use-pods-automation';
import {
  pipelineNumber,
  pipelineText,
  pipelineTrigger,
  type SystemControlLocale,
} from '@/lib/systems/pods-pipeline';

export function PodsPipelineActivity({
  locale,
}: {
  locale: SystemControlLocale;
}) {
  const query = usePodsPipelineActivity(true);
  const t = pipelineText(locale);
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  const outcomes: Record<string, string> = {
    requested: t('Queued', 'في الانتظار'),
    accepted: t('Admitted', 'مقبول'),
    running: t('In progress', 'قيد التنفيذ'),
    verification_required: t('Verifying result', 'جارٍ التحقق من النتيجة'),
    succeeded: t('Completed', 'مكتمل'),
    partial: t('Partial result', 'نتيجة جزئية'),
    failed: t('Failed', 'فشل'),
    cancelled: t('Cancelled', 'ملغى'),
    expired: t('Expired', 'انتهت صلاحيته'),
    active: t('Published', 'منشور'),
    superseded: t('Replaced by a newer edition', 'استُبدل بإصدار أحدث'),
  };
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {t('Newest first', 'الأحدث أولاً')}
        </p>
        <Button
          size="sm"
          variant="outline"
          disabled={query.isFetching}
          onClick={() => query.refetch()}
        >
          {query.isFetching && (
            <Loader2
              aria-hidden="true"
              className="me-2 h-3.5 w-3.5 animate-spin"
            />
          )}
          {t('Refresh activity', 'تحديث النشاط')}
        </Button>
      </div>
      {query.isPending && (
        <p role="status" className="mt-6 text-sm text-muted-foreground">
          {t('Reading recorded activity…', 'جارٍ قراءة النشاط المسجّل…')}
        </p>
      )}
      {query.isError && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {items.length
            ? t(
                'Activity could not be refreshed. Showing the last recorded entries.',
                'تعذّر تحديث النشاط. تُعرض آخر السجلات المحمّلة.'
              )
            : t(
                'Activity could not be loaded. Refresh to try again.',
                'تعذّر تحميل النشاط. حدّث للمحاولة مجدداً.'
              )}
        </p>
      )}
      {!query.isPending && !query.isError && !items.length && (
        <p className="mt-6 text-sm text-muted-foreground">
          {t(
            'No source requests or publications have been recorded for this tenant.',
            'لم تُسجّل طلبات مصادر أو عمليات نشر لهذا المستأجر.'
          )}
        </p>
      )}
      <ol className="mt-3 divide-y">
        {items.map((item) => {
          const publication = item.kind === 'publication';
          const href =
            publication && item.content_id
              ? `/platform/media/atomization?tab=workflow&item=${encodeURIComponent(item.content_id)}`
              : item.source_id
                ? `/platform/sources/${encodeURIComponent(item.source_id)}?from=${encodeURIComponent('/platform/media/sources')}`
                : null;
          return (
            <li key={`${item.kind}:${item.id}`} className="space-y-2 py-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>
                  {publication
                    ? t('Chapters published', 'نُشرت فصول')
                    : t('Source check requested', 'طُلب فحص المصدر')}
                </span>
                <time dateTime={item.event_at}>
                  {new Date(item.event_at).toLocaleString(locale)}
                </time>
              </div>
              {href ? (
                <Link
                  className="block text-sm font-medium hover:underline"
                  dir="auto"
                  href={href}
                >
                  {item.title}
                </Link>
              ) : (
                <p className="text-sm font-medium" dir="auto">
                  {item.title}
                </p>
              )}
              <p className="text-sm">
                {publication
                  ? t('Publication origin not recorded', 'سبب النشر غير مسجّل')
                  : pipelineTrigger(item.trigger, locale)}
              </p>
              {item.actor && item.trigger === 'manual' && (
                <p className="break-words text-xs text-muted-foreground">
                  {t('Recorded requester', 'صاحب الطلب المسجّل')}:{' '}
                  <bdi>{item.actor}</bdi>
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                {outcomes[item.outcome] ??
                  `${t('Recorded state', 'الحالة المسجّلة')}: ${item.outcome}`}
                {publication &&
                  item.units != null &&
                  ` · ${t('Chapters', 'الفصول')}: ${pipelineNumber(item.units, locale)}`}
              </p>
              {publication && (
                <p className="text-xs text-muted-foreground">
                  {t(
                    'Current automatic-publishing settings do not establish the historical publication reason.',
                    'إعدادات النشر التلقائي الحالية لا تثبت سبب النشر التاريخي.'
                  )}
                </p>
              )}
            </li>
          );
        })}
      </ol>
      {query.hasNextPage && (
        <Button
          className="mt-3"
          variant="outline"
          disabled={query.isFetching}
          onClick={() => query.fetchNextPage()}
        >
          {t('Load earlier activity', 'تحميل نشاط أقدم')}
        </Button>
      )}
    </>
  );
}
