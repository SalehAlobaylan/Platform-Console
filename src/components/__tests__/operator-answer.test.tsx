import { fireEvent, render, screen, within } from '@testing-library/react';
import { OperatorAnswer } from '@/components/platform/operator/operator-answer';

const content = {
  blocks: [
    {
      kind: 'conclusion',
      text: 'Media circulation needs attention: the latest run failed and the inventory is stale.',
      evidence_ids: ['run', 'inventory'],
    },
    {
      kind: 'fact',
      text: 'The scheduled run failed because its automation credential was missing.',
      evidence_ids: ['run'],
    },
    {
      kind: 'fact',
      text: 'The inventory contains six reachable items.',
      evidence_ids: ['inventory'],
    },
    {
      kind: 'interpretation',
      text: 'The packet does not establish that the failed run caused the stale inventory.',
      evidence_ids: ['run', 'inventory'],
    },
    {
      kind: 'unknown',
      text: 'Current source delivery remains unverified.',
      evidence_ids: ['inventory'],
    },
    { kind: 'degraded', text: 'The inventory sample is incomplete.' },
    {
      kind: 'recommendation',
      text: 'Review the failed run in Media Circulation.',
      evidence_ids: ['run'],
    },
  ],
};

it('leads with the cited conclusion while keeping uncertainties and the next step visible', () => {
  const evidence = jest.fn();
  render(
    <OperatorAnswer content={content} locale="en" onEvidence={evidence} />
  );
  const conclusion = screen.getByRole('region', { name: 'Brief' });
  expect(within(conclusion).getByText(content.blocks[0].text)).toBeVisible();
  expect(screen.getByText(content.blocks[1].text)).not.toBeVisible();
  expect(screen.getByText(content.blocks[4].text)).toBeVisible();
  expect(screen.getByText(content.blocks[5].text)).toBeVisible();
  expect(screen.getByText(content.blocks[6].text)).toBeVisible();
  fireEvent.click(
    within(conclusion).getByRole('button', { name: 'Sources (2)' })
  );
  expect(evidence).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByText('Findings and evidence'));
  for (const block of content.blocks)
    expect(screen.getByText(block.text)).toBeVisible();
  expect(
    screen.getAllByRole('heading', { name: 'Confirmed facts' })
  ).toHaveLength(1);
});

it('preserves legacy and evidence-only answers without pretending their first fact is a conclusion', () => {
  render(
    <OperatorAnswer content={{ blocks: content.blocks.slice(1) }} locale="en" />
  );
  expect(screen.queryByText('Brief')).not.toBeInTheDocument();
  expect(screen.queryByText('Findings and evidence')).not.toBeInTheDocument();
  for (const block of content.blocks.slice(1))
    expect(screen.getByText(block.text)).toBeVisible();
});

it('supports Arabic disclosures and leaves greetings unlabelled', () => {
  const { rerender } = render(
    <div dir="rtl">
      <OperatorAnswer content={content} locale="ar" />
    </div>
  );
  expect(screen.getByRole('heading', { name: 'الخلاصة' })).toBeVisible();
  fireEvent.click(screen.getByText('النتائج والأدلة'));
  expect(screen.getByText(content.blocks[1].text)).toBeVisible();
  rerender(
    <OperatorAnswer
      content={{ blocks: [{ kind: 'message', text: 'مرحباً، كيف أساعدك؟' }] }}
      locale="ar"
    />
  );
  expect(screen.getByText('مرحباً، كيف أساعدك؟')).toBeVisible();
  expect(screen.queryByRole('heading')).not.toBeInTheDocument();
});
