import { fireEvent, render, screen } from '@testing-library/react';
import {
  OperatorContextDetails,
  OperatorSourcesDetails,
  OperatorStatusDetails,
  OperatorActivityDetails,
} from '../platform/operator/operator-details';
import type {
  OperatorMessage,
  OperatorEvidence,
} from '../platform/operator/operator-workspace-components';
const context = {
  schema_version: 'wahb-operator/v1' as const,
  domain: 'storage_quality',
  view: 'storage',
  subjects: [
    { type: 'content', id: 'one', label: 'Episode one' },
    { type: 'content', id: 'two', label: 'Episode two' },
  ],
  selection: { mode: 'explicit' as const, ids: ['one', 'two'], count: 2 },
  filters: { status: 'READY' },
  draft: {
    kind: 'policy',
    safe_normalized_fields: { enabled: false, title: 'Unsaved policy' },
  },
  available_intents: ['explain' as const],
};
it('previews next-question context and removes one attachment without replacing the others', () => {
  const change = jest.fn();
  render(
    <OperatorContextDetails locale="en" context={context} onChange={change} />
  );
  expect(screen.getByText('For your next question')).toBeVisible();
  expect(screen.getByText('Unsaved policy')).toBeVisible();
  expect(screen.getByText('No')).toBeVisible();
  fireEvent.click(
    screen.getByRole('button', { name: 'Remove record: Episode one' })
  );
  expect(change).toHaveBeenLastCalledWith(
    expect.objectContaining({
      subjects: [context.subjects[1]],
      selection: { mode: 'explicit', ids: ['two'], count: 1 },
      filters: context.filters,
      draft: context.draft,
    })
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Remove filter: Status' })
  );
  expect(change).toHaveBeenLastCalledWith(
    expect.objectContaining({
      filters: {},
      subjects: context.subjects,
      draft: context.draft,
    })
  );
});
const reply: OperatorMessage = {
  id: 'reply',
  kind: 'response',
  actor_type: 'operator',
  created_at: '2026-10-30T12:00:00Z',
  content: {
    blocks: [
      {
        kind: 'conclusion',
        text: 'Tenant usage is measured; bucket quota is unknown.',
        evidence_ids: ['storage_usage:a'],
      },
      {
        kind: 'fact',
        text: 'A separate policy was configured.',
        evidence_ids: ['policy:a'],
      },
    ],
  },
};
const source: OperatorEvidence = {
  id: 'source',
  evidence_id: 'storage_usage:a',
  domain: 'storage_quality',
  authority: 'live',
  adapter_key: 'cms.storage',
  adapter_version: 'v1',
  required_permission: 'content:read',
  record_refs: [],
  deep_link: '/platform/storage',
  observed_at: '2020-01-01T00:00:00Z',
  fetched_at: '2020-01-01T00:00:00Z',
  expires_at: '2020-01-02T00:00:00Z',
  availability: 'available',
  source_version: 'v1',
};
it('links the selected saved claim to its source while retaining collected and current freshness', () => {
  render(
    <OperatorSourcesDetails
      locale="en"
      question="How is storage?"
      reply={reply}
      evidence={[source, { ...source, id: 'other', evidence_id: 'policy:a' }]}
      selectedIDs={['storage_usage:a']}
      onRetry={jest.fn()}
      onAll={jest.fn()}
      onFollow={jest.fn()}
    />
  );
  expect(
    screen.getByText('Tenant usage is measured; bucket quota is unknown.')
  ).toBeVisible();
  expect(
    screen.queryByText('A separate policy was configured.')
  ).not.toBeInTheDocument();
  expect(screen.getByText('Stale')).toBeVisible();
  expect(
    screen.getByRole('link', { name: 'Open current record' })
  ).toHaveAttribute('href', '/platform/storage');
  expect(screen.getByText('Available')).toBeInTheDocument();
});
it('preserves the cited statement when its source record is missing', () => {
  render(
    <OperatorSourcesDetails
      locale="en"
      reply={reply}
      evidence={[]}
      selectedIDs={['storage_usage:a']}
      onRetry={jest.fn()}
      onAll={jest.fn()}
      onFollow={jest.fn()}
    />
  );
  expect(screen.getByText(/cited source record is unavailable/)).toBeVisible();
  expect(
    screen.getByText('Tenant usage is measured; bucket quota is unknown.')
  ).toBeVisible();
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
});
it('separates allowed policy from the limitations of an actual reply', () => {
  render(
    <OperatorStatusDetails
      locale="en"
      controls={{
        controls: {
          read_enabled: true,
          llm_enabled: true,
          execution_enabled: false,
          schedules_enabled: true,
          adapters: [
            {
              disabled: true,
              reason: 'Expired restriction',
              expires_at: '2020-01-01T00:00:00Z',
            },
          ],
        },
      }}
      state="completed"
      reply={{
        ...reply,
        content: {
          blocks: [
            {
              kind: 'degraded',
              text: 'AI interpretation was unavailable for this reply.',
              evidence_ids: [],
            },
          ],
        },
      }}
      onRetry={jest.fn()}
    />
  );
  expect(screen.getAllByText('Allowed')).toHaveLength(3);
  expect(screen.getByText('Disabled')).toBeVisible();
  expect(
    screen.getByText('AI interpretation was unavailable for this reply.')
  ).toBeVisible();
  expect(screen.queryByText('Expired restriction')).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Open Economics' })).toHaveAttribute(
    'href',
    '/platform/economics'
  );
});
it('shows an explicit failed activity read rather than an empty history', () => {
  const retry = jest.fn();
  render(
    <OperatorActivityDetails
      locale="en"
      scope="chat"
      onScope={jest.fn()}
      group="all"
      onGroup={jest.fn()}
      kind="all"
      onKind={jest.fn()}
      tasks={[]}
      error
      onRetry={retry}
      onCancel={jest.fn()}
      onOpen={jest.fn()}
      onMore={jest.fn()}
      hasChat
    />
  );
  expect(screen.getByRole('alert')).toHaveTextContent(
    'An empty list cannot be confirmed'
  );
  expect(
    screen.queryByText('No work matches this view.')
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(retry).toHaveBeenCalledTimes(1);
});
