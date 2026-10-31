import { render, screen } from '@testing-library/react';

import {
  OperatorCapabilityNotices,
  OperatorTranscript,
} from '@/components/platform/operator/operator-workspace-components';
import {
  actionLabel,
  lifecycleLabel,
} from '@/components/platform/operator/operator-copy';

test('Arabic status and independent governance notices preserve dashboard parity', () => {
  render(
    <div dir="rtl">
      <OperatorCapabilityNotices
        locale="ar"
        controls={{
          read_enabled: true,
          llm_enabled: false,
          execution_enabled: true,
          schedules_enabled: false,
        }}
      />
    </div>
  );
  expect(
    screen.getByText('تم تعطيل تفسير النموذج. تظل الأدلة الحتمية متاحة.')
  ).toBeInTheDocument();
  expect(screen.getByText('تم تعطيل الجداول.')).toBeInTheDocument();
});

test('registered action and lifecycle labels never expose raw keys', () => {
  expect(actionLabel('operator.action.run_media_source', 'en')).toBe(
    'Run media source once'
  );
  for (const key of [
    'operator.action.media_circulation_supply_source_run_retry',
    'operator.action.embeddings_pause_campaigns_24h',
    'operator.action.operator_schedule_create_hourly',
    'operator.action.media_sources_resume',
  ]) {
    expect(actionLabel(key, 'en')).toBeTruthy();
    expect(actionLabel(key, 'ar')).toBeTruthy();
    expect(actionLabel(key, 'en')).not.toContain('operator.action');
  }
  expect(actionLabel('unregistered.tool', 'en')).toBeUndefined();
  expect(lifecycleLabel('awaiting_approval', 'ar')).toBe('يحتاج موافقة');
  expect(lifecycleLabel('future_state', 'en')).toBe('Unknown state');
  expect(lifecycleLabel('packet_superseded', 'en')).toBe('Context refreshed');
});

test('a greeting renders as a reply without a degraded or operational-fact label', () => {
  render(
    <OperatorTranscript
      locale="en"
      messages={[
        {
          id: '00000000-0000-4000-8000-000000000001',
          kind: 'response',
          actor_type: 'operator',
          created_at: '2026-10-30T12:00:00Z',
          content: {
            blocks: [
              {
                kind: 'message',
                text: 'Hello! What would you like me to look into?',
              },
            ],
          },
        },
      ]}
      investigationState="completed"
      investigationEvents={[]}
      actions={[]}
      recommendations={[]}
      onEvidence={jest.fn()}
      onPrepare={jest.fn()}
      onCancelInvestigation={jest.fn()}
    />
  );
  expect(
    screen.getByText('Hello! What would you like me to look into?')
  ).toBeInTheDocument();
  expect(screen.queryByText('Degraded result')).not.toBeInTheDocument();
  expect(screen.queryByText('Confirmed facts')).not.toBeInTheDocument();
  expect(
    screen.queryByText('No changes are suggested for this reply.')
  ).not.toBeInTheDocument();
});
