'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useOpsClock } from '@/hooks/use-operations-command-center';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { OpsFleetStatus, OpsCommandScope } from '@/lib/api/cms/operations';
import {
  OpsBadge,
  OpsTime,
  opsLabel,
  type OpsCopy,
  type OpsLocale,
} from './presentation';
const stateOrder = [
  'run_stuck',
  'stalled',
  'errored',
  'attention',
  'unknown',
  'unconfigured',
  'paused',
  'running',
  'idle',
  'disabled',
];
export function FleetStatus({
  fleet,
  fresh,
  review,
  locale,
  t,
}: {
  fleet: OpsFleetStatus[];
  fresh: boolean;
  review: (scope: OpsCommandScope) => void;
  locale: OpsLocale;
  t: OpsCopy;
}) {
  const now = useOpsClock();
  const [attentionOnly, setAttentionOnly] = useState(false);
  const rows = useMemo(
    () =>
      [...fleet]
        .filter(
          (row) =>
            !attentionOnly ||
            [
              'stalled',
              'run_stuck',
              'errored',
              'attention',
              'unknown',
            ].includes(row.state) ||
            !!row.open_attention_count
        )
        .sort(
          (a, b) =>
            stateOrder.indexOf(a.state) - stateOrder.indexOf(b.state) ||
            a.member_label.localeCompare(b.member_label) ||
            a.lane_key.localeCompare(b.lane_key) ||
            (a.tenant_id ?? '').localeCompare(b.tenant_id ?? '')
        ),
    [fleet, attentionOnly]
  );
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle>{t('Fleet status', 'حالة الأنظمة')}</CardTitle>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={attentionOnly}
            onChange={(event) => setAttentionOnly(event.target.checked)}
          />
          {t('Needs attention only', 'ما يحتاج الانتباه فقط')}
        </label>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.map((row) => (
          <article
            key={`${row.member_key}:${row.lane_key}:${row.tenant_id}`}
            className="space-y-2 border p-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <Link
                  href={row.cockpit_path}
                  className="font-medium hover:underline"
                >
                  {row.member_label} · {row.lane_label}
                </Link>
                <p
                  className="break-words text-xs text-muted-foreground"
                  dir="ltr"
                >
                  {row.tenant_id || 'platform'} · {row.kind} · {row.mode || '—'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <OpsBadge value={fresh ? row.state : 'unknown'} />
                {row.pausable && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={
                      !fresh ||
                      row.state === 'unknown' ||
                      row.state === 'errored' ||
                      row.state === 'unconfigured'
                    }
                    onClick={() =>
                      review({
                        command: 'pause_member',
                        member_key: row.member_key,
                        lane_key: row.lane_key,
                        tenant_id: row.tenant_id,
                      })
                    }
                  >
                    {row.member_key === 'system_health'
                      ? t('Pause containment', 'أوقف الاحتواء مؤقتاً')
                      : t('Pause', 'إيقاف مؤقت')}
                  </Button>
                )}
              </div>
            </div>
            {!fresh && (
              <p className="text-xs text-muted-foreground">
                {t('Last observed state', 'آخر حالة مرصودة')}:{' '}
                {opsLabel(row.state)}
              </p>
            )}
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
              <span>
                {t('Last run', 'آخر تشغيل')}:{' '}
                <OpsTime value={row.last_run_at} locale={locale} />{' '}
                {row.last_run_status && opsLabel(row.last_run_status)}
              </span>
              <span>
                {t('Next due', 'الاستحقاق التالي')}:{' '}
                <OpsTime value={row.next_due_at} locale={locale} />
              </span>
              {row.deep_due_at && (
                <span>
                  {t('Deep check due', 'استحقاق الفحص العميق')}:{' '}
                  <OpsTime value={row.deep_due_at} locale={locale} />
                </span>
              )}
              {row.paused_until && (
                <span>
                  {Date.parse(row.paused_until) > now
                    ? t('Pause expires', 'ينتهي الإيقاف')
                    : t('Pause expired', 'انتهى الإيقاف')}
                  : <OpsTime value={row.paused_until} locale={locale} />
                </span>
              )}
              <span>
                {t('Liveness', 'الرصد')}: {opsLabel(row.liveness)}
              </span>
              <span>
                {t('Open attention', 'التنبيهات المفتوحة')}:{' '}
                {row.open_attention_count ?? 0}
              </span>
            </div>
            {row.trust && row.trust.state !== 'not_applicable' && (
              <p className="text-xs">
                {t('Trust', 'الثقة')}:{' '}
                {row.trust.total > 0 && (
                  <>
                    {row.trust.earned}/{row.trust.total} ·{' '}
                  </>
                )}
                {opsLabel(row.trust.state)} {row.trust.detail}
              </p>
            )}
            {row.containment?.opted_out && (
              <p className="text-xs">
                {t(
                  'Opted out of System Health containment',
                  'مستثنى من احتواء صحة النظام'
                )}
              </p>
            )}
            {row.containment?.pause_scope && (
              <p className="text-xs text-muted-foreground">
                {row.containment.pause_scope}
              </p>
            )}
            {(row.error || row.evidence || row.last_run_headline) && (
              <p
                className={`text-sm ${row.error ? 'text-destructive' : 'text-muted-foreground'}`}
                dir="auto"
              >
                {row.error || row.evidence || row.last_run_headline}
              </p>
            )}
          </article>
        ))}
        {!rows.length && (
          <p className="text-sm text-muted-foreground">
            {t('No matching lanes.', 'لا توجد مسارات مطابقة.')}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
