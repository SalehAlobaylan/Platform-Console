'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  useOpsCommand,
  useOpsCommands,
} from '@/hooks/use-operations-command-center';
import type { OpsCommandScope } from '@/lib/api/cms/operations';
import {
  OpsBadge,
  OpsNotice,
  OpsPager,
  OpsTime,
  opsLabel,
  type OpsCopy,
  type OpsLocale,
} from './presentation';
export function CommandHistory({
  fresh,
  review,
  locale,
  t,
}: {
  fresh: boolean;
  review: (scope: OpsCommandScope) => void;
  locale: OpsLocale;
  t: OpsCopy;
}) {
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<string>();
  const query = useOpsCommands(offset);
  const detail = useOpsCommand(selected);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('Command history', 'سجل الأوامر')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {query.isLoading && (
          <p role="status">{t('Loading commands…', 'جارٍ تحميل الأوامر…')}</p>
        )}
        {query.isError && (
          <OpsNotice t={t} retry={() => void query.refetch()}>
            {t('Command history is unavailable.', 'سجل الأوامر غير متاح.')}
          </OpsNotice>
        )}
        {query.data?.items.map((command) => (
          <div key={command.id} className="space-y-2 border p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                onClick={() =>
                  setSelected(selected === command.id ? undefined : command.id)
                }
                className="font-medium underline-offset-4 hover:underline"
                aria-expanded={selected === command.id}
              >
                {opsLabel(command.command)} · {command.scope}
              </button>
              <OpsBadge value={command.status} />
            </div>
            <p dir="auto">{command.reason}</p>
            <p className="text-xs text-muted-foreground">
              {command.actor_email || command.actor_id} ·{' '}
              <OpsTime value={command.created_at} locale={locale} />
              {command.ttl_minutes != null && (
                <>
                  {' '}
                  · {command.ttl_minutes} {t('minutes', 'دقيقة')}
                </>
              )}
            </p>
            <p className="text-xs" dir="auto">
              {Object.entries(command.counts)
                .map(([name, count]) => `${opsLabel(name)}: ${count}`)
                .join(' · ')}
            </p>
            {command.source_command_id && (
              <p className="break-all text-xs" dir="ltr">
                {t('Source pause', 'الإيقاف الأصلي')}:{' '}
                {command.source_command_id}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelected(command.id)}
              >
                {t('Inspect targets', 'افحص الأهداف')}
              </Button>
              {command.command.startsWith('pause') &&
                command.status !== 'failed' && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!fresh}
                    onClick={() =>
                      review({
                        command: 'resume',
                        source_command_id: command.id,
                      })
                    }
                  >
                    {t('Review resume', 'راجع الاستئناف')}
                  </Button>
                )}
            </div>
            {selected === command.id && (
              <div className="space-y-2 border-t pt-3">
                {detail.isLoading && (
                  <p role="status">
                    {t('Reading target ledger…', 'جارٍ قراءة سجل الأهداف…')}
                  </p>
                )}
                {detail.isError && (
                  <OpsNotice t={t} retry={() => void detail.refetch()}>
                    {t('Target ledger unavailable.', 'سجل الأهداف غير متاح.')}
                  </OpsNotice>
                )}
                {detail.data?.actions.map((action) => (
                  <div
                    className="space-y-1 bg-muted/40 p-3 text-xs"
                    key={action.id}
                  >
                    <p dir="ltr">
                      {action.member_key} / {action.lane_key} ·{' '}
                      {action.tenant_id || 'platform'}
                    </p>
                    <OpsBadge value={action.outcome} />
                    <p dir="auto">{action.reason || action.guardrail}</p>
                    <p>
                      {t('Prior pause', 'الإيقاف السابق')}:{' '}
                      <OpsTime
                        value={action.prior_paused_until}
                        locale={locale}
                      />{' '}
                      · {t('Written pause', 'الإيقاف المكتوب')}:{' '}
                      <OpsTime
                        value={action.written_paused_until}
                        locale={locale}
                      />
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {query.data && !query.data.items.length && !query.isError && (
          <p className="text-sm text-muted-foreground">
            {t('No recorded commands.', 'لا توجد أوامر مسجّلة.')}
          </p>
        )}
        {query.data && (
          <OpsPager
            offset={offset}
            limit={20}
            total={query.data.total}
            more={query.data.has_more ?? query.data.items.length === 20}
            onChange={setOffset}
            t={t}
          />
        )}
      </CardContent>
    </Card>
  );
}
