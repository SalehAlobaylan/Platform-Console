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

test('separates health response time from readiness endpoint timing', () => {
  render(
    <ServiceCard
      service={{
        ...service,
        latencyMs: 3,
        probes: [
          {
            label: 'Health',
            endpointUrl: 'http://cms/health',
            latencyMs: 3,
            httpStatus: 200,
          },
          {
            label: 'Readiness',
            endpointUrl: 'http://cms/ready',
            latencyMs: 630,
            httpStatus: 200,
          },
        ],
      }}
    />
  );
  expect(screen.getByText('Health response')).toBeInTheDocument();
  fireEvent.click(screen.getByText('Endpoint timings'));
  expect(screen.getByText('Readiness')).toBeInTheDocument();
  expect(screen.getByText('630 ms · HTTP 200')).toBeInTheDocument();
});

test('keeps failed reviewed maintenance visible and sends no request when cancelled', async () => {
  mockRun.mockRejectedValueOnce(new Error('Maintenance request expired'));
  render(<ServiceCard service={service} />);
  const trigger = screen.getByRole('button', { name: 'Restart service' });
  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(mockRun).not.toHaveBeenCalled();

  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole('button', { name: 'Restart' }));
  expect(await screen.findByText('Maintenance request expired')).toBeVisible();
  expect(screen.getByRole('alertdialog', { name: 'Restart CMS?' })).toBeVisible();
  expect(mockRun).toHaveBeenCalledTimes(1);
});
