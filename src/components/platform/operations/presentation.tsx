import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
export type OpsLocale = 'en' | 'ar';
export type OpsCopy = (en: string, ar: string) => string;
export const opsLabel = (value: string) => value.replaceAll('_', ' ');
export function OpsBadge({ value }: { value: string }) {
  const variant = [
    'incident',
    'critical',
    'errored',
    'stalled',
    'run_stuck',
    'failed',
  ].includes(value)
    ? 'destructive'
    : ['attention', 'major', 'paused', 'partial', 'warning'].includes(value)
      ? 'warning'
      : [
            'all_clear',
            'completed',
            'succeeded',
            'cleared',
            'restored',
          ].includes(value)
        ? 'success'
        : 'secondary';
  return <Badge variant={variant}>{opsLabel(value)}</Badge>;
}
export function OpsTime({
  value,
  locale,
}: {
  value?: string | null;
  locale: OpsLocale;
}) {
  if (!value || !Number.isFinite(Date.parse(value)))
    return <span>{locale === 'ar' ? 'غير متاح' : 'Unavailable'}</span>;
  return (
    <time dateTime={value} title={new Date(value).toLocaleString(locale)}>
      {new Date(value).toLocaleString(locale, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })}
    </time>
  );
}
export function OpsNotice({
  children,
  retry,
  t,
}: {
  children: React.ReactNode;
  retry?: () => void;
  t: OpsCopy;
}) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 border border-destructive/50 p-3 text-sm"
    >
      <span>{children}</span>
      {retry && (
        <Button size="sm" variant="outline" onClick={retry}>
          {t('Try again', 'أعد المحاولة')}
        </Button>
      )}
    </div>
  );
}
export function OpsPager({
  offset,
  limit,
  total,
  more,
  onChange,
  t,
}: {
  offset: number;
  limit: number;
  total?: number;
  more?: boolean;
  onChange: (offset: number) => void;
  t: OpsCopy;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <span aria-live="polite" aria-atomic="true">
        {total == null
          ? ''
          : total === 0 || offset >= total
            ? `0 / ${total}`
            : `${offset + 1}–${Math.min(offset + limit, total)} / ${total}`}
      </span>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={!offset}
          onClick={() => onChange(Math.max(0, offset - limit))}
        >
          {t('Previous', 'السابق')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!more}
          onClick={() => onChange(offset + limit)}
        >
          {t('Next', 'التالي')}
        </Button>
      </div>
    </div>
  );
}
export function opsSnapshotFresh(asOf?: string, now = Date.now()) {
  const at = asOf ? Date.parse(asOf) : NaN;
  return Number.isFinite(at) && now - at <= 90_000 && at <= now + 5_000;
}
