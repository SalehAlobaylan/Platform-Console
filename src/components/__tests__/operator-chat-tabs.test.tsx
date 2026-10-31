import { fireEvent, render, screen, within } from '@testing-library/react';
import {
  OperatorChatTabs,
  operatorTabStatus,
} from '../platform/operator/operator-chat-tabs';
import type { OperatorThread } from '@/hooks/use-operator';
const a = {
  id: '00000000-0000-4000-8000-000000000001',
  threadID: '00000000-0000-4000-8000-000000000003',
  title: 'Storage',
  href: '/platform/operator?thread=00000000-0000-4000-8000-000000000003',
};
const b = {
  id: '00000000-0000-4000-8000-000000000002',
  title: 'Pipeline',
  href: '/platform/operator?draft=00000000-0000-4000-8000-000000000002',
};
it('reports saving, unread completion, approval, failure and unavailable status honestly', () => {
  const summary = (state: string, unread = 0) =>
    ({ activity_state: state, unread_count: unread }) as OperatorThread;
  expect(
    operatorTabStatus(a, { saving: true }, undefined, true, 'en')
  ).toMatchObject({ label: 'Saving', working: true });
  expect(operatorTabStatus(b, undefined, undefined, false, 'en')).toMatchObject(
    { label: 'Draft' }
  );
  expect(
    operatorTabStatus(a, undefined, summary('completed', 1), false, 'en')
  ).toMatchObject({ unread: true });
  expect(
    operatorTabStatus(a, undefined, summary('needs_approval'), false, 'en')
  ).toMatchObject({ attention: true });
  expect(
    operatorTabStatus(
      a,
      {
        pending: {
          text: 'cancel me',
          at: 'now',
          owner: a.id,
          investigationID: a.threadID,
        },
      },
      summary('cancelled'),
      false,
      'en'
    )
  ).toMatchObject({ label: 'Cancelled' });
  expect(
    operatorTabStatus(a, undefined, summary('failed'), false, 'en')
  ).toMatchObject({ attention: true });
  expect(
    operatorTabStatus(a, undefined, summary('completed'), true, 'en')
  ).toMatchObject({ label: 'Status unavailable', attention: true });
});
it.each(['en', 'ar'] as const)(
  'supports roving keyboard selection and closing without cancelling in %s',
  (locale) => {
    const select = jest.fn(),
      close = jest.fn();
    render(
      <OperatorChatTabs
        locale={locale}
        activeID={a.id}
        tabs={[
          { tab: a, status: { label: 'Working', working: true } },
          { tab: b, status: { label: 'Draft' } },
        ]}
        onSelect={select}
        onClose={close}
      />
    );
    const tabs = within(screen.getByRole('tablist')).getAllByRole('tab');
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[1]).toHaveAttribute('tabindex', '-1');
    fireEvent.keyDown(tabs[0], {
      key: locale === 'ar' ? 'ArrowLeft' : 'ArrowRight',
    });
    expect(select).toHaveBeenLastCalledWith(b, true);
    fireEvent.keyDown(tabs[0], { key: 'End' });
    expect(select).toHaveBeenLastCalledWith(b, true);
    fireEvent.keyDown(tabs[0], { key: 'Delete' });
    expect(close).toHaveBeenCalledWith(a.id);
    expect(screen.getByRole('button', { name: /\(2\)/ })).toBeInTheDocument();
  }
);
