import { act, fireEvent, render, screen } from '@testing-library/react';
import { ServiceCard } from '../platform/system-health/service-card';

const mockRun = jest.fn();
jest.mock('@/lib/stores/auth', () => ({ useIsAdmin: () => true }));
jest.mock('@/hooks/use-audited-action', () => ({
  useAuditedAction: () => ({ run: mockRun, isPending: false }),
}));

const service = {
  name: 'cms' as const,
  displayName: 'CMS',
  endpointUrl: 'http://cms',
  status: 'healthy' as const,
  latencyMs: 1,
  httpStatus: 200,
  deps: [],
};

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-10-18T10:00:00Z'));
  mockRun.mockClear();
});
afterEach(() => jest.useRealTimers());

test('an open maintenance confirmation becomes blocked after a failed refresh', () => {
  const view = render(<ServiceCard service={service} stale={false} />);
  fireEvent.click(screen.getByText('Service maintenance'));
  fireEvent.click(screen.getByRole('button', { name: 'Restart service' }));
  view.rerender(<ServiceCard service={service} stale />);
  expect(screen.getByRole('button', { name: 'Restart' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Restart' }));
  expect(mockRun).not.toHaveBeenCalled();
});

test('an open maintenance confirmation ages without a parent refresh', () => {
  render(
    <ServiceCard service={service} observedAt={new Date().toISOString()} />
  );
  fireEvent.click(screen.getByText('Service maintenance'));
  fireEvent.click(screen.getByRole('button', { name: 'Restart service' }));
  act(() => jest.advanceTimersByTime(46_000));
  expect(screen.getByRole('button', { name: 'Restart' })).toBeDisabled();
  expect(mockRun).not.toHaveBeenCalled();
});
