import { fireEvent, render, screen, within } from '@testing-library/react';
import { OperatorActionGroups } from '@/components/platform/operator/operator-action-groups';
import type { OperatorAction } from '@/hooks/use-operator';

const href = '/platform/media/circulation';
function manual(
  task: string,
  link = href,
  domain = 'media_circulation'
): OperatorAction {
  return {
    kind: 'manual',
    localized_action_key: `operator.manual.${domain}.${task}`,
    reason_key: 'native_only',
    affected_domain: domain,
    deep_link: link,
    manual_only: true,
  };
}
const recommendation = {
  id: 'one',
  rank: 1,
  title: 'Review circulation recommendations',
  summary: 'Review the recorded run and pending recommendations.',
  deep_link: href,
  manual_only: true,
};
const plan: Extract<OperatorAction, { kind: 'plan' }> = {
  kind: 'plan',
  key: 'media_sources.pause',
  localized_action_key: 'operator.action.media_sources_pause',
  risk_tier: 'routine',
  target_type: 'source',
  argument_schema: 'v1',
  target_ids: ['source-one'],
  affected_domains: ['media_sources'],
  cancellation: 'before_start_only',
  rollback: 'resume',
  contingencies: [],
  manual_only: false,
};

it('clusters five manual tasks and their recommendation into one workflow link', () => {
  const prepare = jest.fn();
  render(
    <OperatorActionGroups
      locale="en"
      actions={['generate', 'apply', 'dismiss', 'revert', 'override'].map(
        (task) => manual(task)
      )}
      recommendations={[recommendation]}
      onPrepare={prepare}
    />
  );
  expect(
    screen.getAllByRole('link', { name: 'Open native workflow' })
  ).toHaveLength(1);
  expect(
    screen.getByRole('link', { name: 'Open native workflow' })
  ).toHaveAttribute('href', href);
  expect(screen.getByText(recommendation.title)).toBeVisible();
  expect(screen.getByText(recommendation.summary)).toBeVisible();
  expect(screen.getByText('Generate recommendations')).not.toBeVisible();
  fireEvent.click(screen.getByText('Available tasks (5)'));
  expect(screen.getByText('Generate recommendations')).toBeVisible();
  expect(screen.getByText('Review overrides')).toBeVisible();
  expect(screen.getAllByRole('listitem')).toHaveLength(5);
  expect(prepare).not.toHaveBeenCalled();
});

it('separates plan reviews from navigation and passes the exact CMS action to preview', () => {
  const prepare = jest.fn();
  render(
    <OperatorActionGroups
      locale="en"
      actions={[plan, manual('generate')]}
      recommendations={[recommendation]}
      onPrepare={prepare}
    />
  );
  const review = screen.getByRole('region', { name: 'Review a change' });
  const workflow = screen.getByRole('region', { name: 'Open a workflow' });
  expect(within(review).queryByRole('link')).not.toBeInTheDocument();
  expect(within(workflow).queryByRole('button')).not.toBeInTheDocument();
  expect(prepare).not.toHaveBeenCalled();
  fireEvent.click(within(review).getByRole('button', { name: 'Review plan' }));
  expect(prepare).toHaveBeenCalledWith(plan);
  expect(prepare).toHaveBeenCalledTimes(1);
});

it('keeps distinct record scopes and ambiguous domain referrals separate', () => {
  const { rerender } = render(
    <OperatorActionGroups
      locale="en"
      actions={[
        manual('generate', `${href}?source=one`),
        manual('generate', `${href}?source=two`),
      ]}
      recommendations={[]}
      onPrepare={jest.fn()}
    />
  );
  const links = screen.getAllByRole('link');
  expect(links.map((link) => link.getAttribute('href'))).toEqual([
    `${href}?source=one`,
    `${href}?source=two`,
  ]);
  rerender(
    <OperatorActionGroups
      locale="en"
      actions={[
        manual('generate'),
        manual('generate', href, 'news_circulation'),
      ]}
      recommendations={[recommendation]}
      onPrepare={jest.fn()}
    />
  );
  expect(screen.getAllByRole('link')).toHaveLength(3);
  expect(
    screen.getByRole('heading', { name: 'Media Circulation' })
  ).toBeVisible();
  expect(
    screen.getByRole('heading', { name: 'News Circulation' })
  ).toBeVisible();
  expect(
    screen.getByRole('heading', { name: recommendation.title })
  ).toBeVisible();
});

it('localizes task clusters and does not enable unknown plan capabilities', () => {
  const prepare = jest.fn();
  render(
    <div dir="rtl">
      <OperatorActionGroups
        locale="ar"
        actions={[
          { ...plan, localized_action_key: 'unknown.tool' },
          manual('generate'),
          manual('apply'),
        ]}
        recommendations={[recommendation]}
        onPrepare={prepare}
      />
    </div>
  );
  expect(screen.getByRole('button', { name: 'مراجعة الخطة' })).toBeDisabled();
  fireEvent.click(screen.getByText('المهام المتاحة (2)'));
  expect(screen.getByText('إنشاء توصيات')).toBeVisible();
  expect(screen.getByText('تطبيق التوصيات')).toBeVisible();
  expect(
    screen.getAllByRole('link', { name: 'فتح سير العمل الأصلي' })
  ).toHaveLength(1);
  expect(prepare).not.toHaveBeenCalled();
});

it('puts the CMS primary recommendation workflow first without changing its scope', () => {
  render(
    <OperatorActionGroups
      locale="en"
      actions={[
        manual('restore', '/platform/storage', 'storage_quality'),
        manual('generate'),
      ]}
      recommendations={[recommendation]}
      onPrepare={jest.fn()}
    />
  );
  expect(
    screen.getAllByRole('link').map((link) => link.getAttribute('href'))
  ).toEqual([href, '/platform/storage']);
});
