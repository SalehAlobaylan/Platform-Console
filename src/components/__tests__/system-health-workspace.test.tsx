import { fireEvent, render, screen, within } from '@testing-library/react';
import { OverallStatusHeader } from '../platform/system-health/overall-status-header';
import { IssuesPanel } from '../platform/system-health/issues-panel';
import { ServiceInventory } from '../platform/system-health/service-inventory';
import type {
  ServiceHealth,
  SystemHealthSnapshot,
} from '@/types/platform/system-health';

const healthy: ServiceHealth = {
  name: 'cms',
  displayName: 'CMS',
  endpointUrl: '',
  status: 'healthy',
  latencyMs: 10,
  httpStatus: 200,
  deps: [],
};
const unhealthy: ServiceHealth = {
  ...healthy,
  name: 'aggregation',
  displayName: 'Aggregation',
  status: 'unhealthy',
};
const snapshot: SystemHealthSnapshot = {
  timestamp: new Date().toISOString(),
  overall: 'healthy',
  services: [healthy],
  issues: [],
  envAudit: [],
};

beforeEach(() => localStorage.clear());

test('unavailable evidence is never presented as zero healthy services', () => {
  render(<OverallStatusHeader isFetching={false} isError stale={false} />);
  expect(screen.getByText('Service checks unavailable')).toBeInTheDocument();
  expect(screen.queryByText('0 / 0')).not.toBeInTheDocument();
  expect(screen.getAllByText('—')).toHaveLength(4);
});

test('keeps cached readings but labels them stale after a refresh failure', () => {
  render(
    <OverallStatusHeader snapshot={snapshot} isFetching={false} isError stale />
  );
  expect(screen.getByText('Stale snapshot')).toBeInTheDocument();
  expect(screen.getByText('1 / 1')).toBeInTheDocument();
  expect(screen.queryByText('Service checks healthy')).not.toBeInTheDocument();
});

test('prioritizes affected services and preserves explicit inspection', () => {
  const inspect = jest.fn();
  render(
    <ServiceInventory services={[healthy, unhealthy]} onInspect={inspect} />
  );
  expect(screen.getAllByRole('listitem')[0]).toHaveTextContent('Aggregation');
  fireEvent.click(screen.getByRole('button', { name: /Needs review/ }));
  expect(
    screen.queryByRole('button', { name: 'Inspect CMS' })
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Inspect Aggregation' }));
  expect(inspect).toHaveBeenCalledWith(unhealthy);
});

test('critical findings cannot be snoozed and stay before warnings', () => {
  render(
    <IssuesPanel
      issues={[
        { severity: 'warning', message: 'Retained failed jobs' },
        { severity: 'critical', service: 'cms', message: 'CMS unreachable' },
      ]}
    />
  );
  const rows = screen.getAllByRole('listitem');
  expect(rows[0]).toHaveTextContent('CMS unreachable');
  expect(
    within(rows[0]).queryByRole('button', { name: /Snooze/ })
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Snooze for 4 hours/ }));
  expect(screen.getByText('CMS unreachable')).toBeInTheDocument();
  expect(screen.queryByText('Retained failed jobs')).not.toBeInTheDocument();
  fireEvent.click(
    screen.getByRole('button', { name: 'Restore 1 snoozed warning' })
  );
  expect(screen.getByText('Retained failed jobs')).toBeInTheDocument();
});


test('snoozing in an inspector updates the mounted overview too', () => {
  const issues = [{ severity: 'warning' as const, message: 'Shared warning' }];
  render(<><IssuesPanel issues={issues} /><IssuesPanel issues={issues} /></>);
  fireEvent.click(screen.getAllByRole('button', { name: /Snooze for 4 hours/ })[1]);
  expect(screen.queryByText('Shared warning')).not.toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: 'Restore 1 snoozed warning' })).toHaveLength(2);
});
