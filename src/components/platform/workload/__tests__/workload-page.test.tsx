import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import WorkloadPage from '@/app/(dashboard)/platform/workload/page';
import * as hooks from '@/hooks/use-workload';
import { useAuth } from '@/hooks/use-auth';
import {
  decision,
  observedAt,
  permit,
  qualification,
  registry,
  resource,
  snapshot,
  status,
} from './fixtures';
let mockParams = '';
const mockReplace = jest.fn();
const mockRefresh = jest.fn();
jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(mockParams),
  useRouter: () => ({ replace: mockReplace }),
}));
jest.mock('@/hooks/use-auth');
jest.mock('@/hooks/use-workload');
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: mockRefresh }),
}));
const save = { mutateAsync: jest.fn(), reset: jest.fn(), isPending: false };
const pause = { mutateAsync: jest.fn(), reset: jest.fn(), isPending: false };
const revoke = { mutateAsync: jest.fn(), reset: jest.fn(), isPending: false };
const query = <T,>(data: T) => ({
  data,
  isError: false,
  isPending: false,
  isFetching: false,
  refetch: jest.fn(),
});
beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers().setSystemTime(new Date(observedAt));
  mockParams = '';
  (useAuth as jest.Mock).mockReturnValue({
    user: { role: 'admin' },
    isLoading: false,
  });
  (hooks.useWorkloadStatus as jest.Mock).mockReturnValue(query(status));
  (hooks.useWorkloadRegistry as jest.Mock).mockReturnValue(query(registry));
  (hooks.useWorkloadQualification as jest.Mock).mockReturnValue(
    query(qualification)
  );
  (hooks.useWorkloadDecisions as jest.Mock).mockReturnValue(
    query({ data: [decision] })
  );
  (hooks.useWorkloadPermits as jest.Mock).mockReturnValue(
    query({ data: [permit] })
  );
  (hooks.useWorkloadSnapshots as jest.Mock).mockReturnValue(
    query({ data: [snapshot] })
  );
  (hooks.useUpdateWorkloadPolicy as jest.Mock).mockReturnValue(save);
  (hooks.usePauseWorkload as jest.Mock).mockReturnValue(pause);
  (hooks.useRevokeWorkloadPermit as jest.Mock).mockReturnValue(revoke);
  save.mutateAsync.mockResolvedValue({ ...status.policy, revision: 2 });
  pause.mutateAsync.mockResolvedValue({ ...status.policy, revision: 2 });
  revoke.mutateAsync.mockResolvedValue(undefined);
});
afterEach(() => jest.useRealTimers());
it('labels an incident consistently in historical observations instead of claiming that an empty resource was full', () => {
  mockParams = 'tab=evidence';
  (hooks.useWorkloadSnapshots as jest.Mock).mockReturnValue(
    query({
      data: [
        {
          ...snapshot,
          healthy: false,
          state: 'saturated',
          pressure: 0,
          reason: 'Confirmed System Health incident affects this resource',
        },
      ],
    })
  );
  render(<WorkloadPage />);
  expect(screen.getByText('Health incident')).toBeInTheDocument();
  expect(screen.queryByText('At capacity')).not.toBeInTheDocument();
});
it('distinguishes healthy idle capacity from an unresolved health incident at zero usage', () => {
  (hooks.useWorkloadStatus as jest.Mock).mockReturnValue(
    query({
      ...status,
      resources: [
        { ...resource, reserved: 0 },
        {
          ...resource,
          key: 'agg_news_queue',
          kind: 'pressure',
          healthy: false,
          state: 'saturated',
          pressure: 0,
          limit: status.policy.resource_limits.agg_news_queue,
          reason: 'Confirmed System Health incident affects this resource',
        },
      ],
    })
  );
  render(<WorkloadPage />);
  expect(screen.getByText('Idle')).toBeInTheDocument();
  expect(screen.getByText('Health incident')).toBeInTheDocument();
  expect(screen.getByText('No slots reserved')).toBeInTheDocument();
  expect(screen.getByText('No queued jobs reported')).toBeInTheDocument();
  expect(screen.queryByText('Service unavailable')).not.toBeInTheDocument();
  expect(screen.queryByText('At capacity')).not.toBeInTheDocument();
  expect(
    screen.getByText('Service health needs attention')
  ).toBeInTheDocument();
  expect(
    screen.getByRole('link', { name: 'Review health incidents' })
  ).toHaveAttribute('href', '/platform/system-health');
  fireEvent.click(screen.getByRole('button', { name: /Needs attention 1/ }));
  expect(screen.queryByText('Idle')).not.toBeInTheDocument();
  expect(screen.getByText('Health incident')).toBeInTheDocument();
});
it('keeps healthy empty resources out of the attention filter', () => {
  (hooks.useWorkloadStatus as jest.Mock).mockReturnValue(
    query({ ...status, resources: [{ ...resource, reserved: 0 }] })
  );
  render(<WorkloadPage />);
  expect(screen.getByText('Idle')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Needs attention 0/ }));
  expect(screen.getByText('No resource needs attention')).toBeInTheDocument();
  expect(screen.queryByText('Text processing')).not.toBeInTheDocument();
});
it('describes a failed readiness check without claiming that the service is offline or idle', () => {
  (hooks.useWorkloadStatus as jest.Mock).mockReturnValue(
    query({
      ...status,
      resources: [
        {
          ...resource,
          healthy: false,
          reserved: 0,
          reason: 'Existing System Health readiness contract: degraded',
        },
      ],
    })
  );
  render(<WorkloadPage />);
  expect(screen.getByText('Not ready')).toBeInTheDocument();
  expect(screen.queryByText('Idle')).not.toBeInTheDocument();
  expect(screen.queryByText('Health incident')).not.toBeInTheDocument();
  expect(
    screen.getByRole('link', { name: 'Check System Health' })
  ).toBeInTheDocument();
});
it('keeps an absent reading unknown instead of treating zero as idle', () => {
  (hooks.useWorkloadStatus as jest.Mock).mockReturnValue(
    query({
      ...status,
      resources: [
        { ...resource, available: false, healthy: false, reserved: 0 },
      ],
    })
  );
  render(<WorkloadPage />);
  expect(screen.getByText('No reading')).toBeInTheDocument();
  expect(screen.queryByText('Idle')).not.toBeInTheDocument();
  expect(screen.queryByText('No slots reserved')).not.toBeInTheDocument();
  expect(screen.queryByRole('meter')).not.toBeInTheDocument();
});
it('localizes the distinction between idle work and health incidents in Arabic', () => {
  mockParams = 'locale=ar';
  (hooks.useWorkloadStatus as jest.Mock).mockReturnValue(
    query({
      ...status,
      resources: [
        { ...resource, reserved: 0 },
        {
          ...resource,
          key: 'cms_db',
          healthy: false,
          reserved: 0,
          reason: 'Confirmed System Health incident affects this resource',
        },
      ],
    })
  );
  render(<WorkloadPage />);
  expect(screen.getByText('دون عمل حاليًا')).toBeInTheDocument();
  expect(screen.getByText('حادث خدمة')).toBeInTheDocument();
  expect(
    screen.getByRole('link', { name: 'مراجعة حوادث صحة النظام' })
  ).toBeInTheDocument();
});
it('accepts a fresh heartbeat arriving between clock ticks', () => {
  const view = render(<WorkloadPage />);
  const receivedAt = new Date(Date.parse(observedAt) + 10_000);
  jest.setSystemTime(receivedAt);
  (hooks.useWorkloadStatus as jest.Mock).mockReturnValue(
    query({
      ...status,
      heartbeat_at: receivedAt.toISOString(),
      resources: [{ ...resource, observed_at: receivedAt.toISOString() }],
    })
  );
  view.rerender(<WorkloadPage />);
  expect(
    screen.queryByText('Heartbeat is missing or out of date')
  ).not.toBeInTheDocument();
  expect(screen.getByText('Available')).toBeInTheDocument();
});
it('still marks evidence stale when time advances without a successful refresh', () => {
  render(<WorkloadPage />);
  act(() => jest.advanceTimersByTime(105_000));
  expect(
    screen.getByText('Heartbeat is missing or out of date')
  ).toBeInTheDocument();
  expect(screen.queryByText('Available')).not.toBeInTheDocument();
});
it('shows full reservations as at capacity even when the service is healthy', () => {
  (hooks.useWorkloadStatus as jest.Mock).mockReturnValue(
    query({
      ...status,
      resources: [{ ...resource, reserved: resource.limit.capacity }],
    })
  );
  render(<WorkloadPage />);
  expect(screen.getByText('At capacity')).toBeInTheDocument();
  expect(screen.queryByText('Available')).not.toBeInTheDocument();
  expect(
    screen.getByText('Some resources are under pressure')
  ).toBeInTheDocument();
});
it('filters the capacity board to resources needing attention and restores all resources', () => {
  (hooks.useWorkloadStatus as jest.Mock).mockReturnValue(
    query({
      ...status,
      resources: [
        resource,
        {
          ...resource,
          key: 'agg_news_queue',
          kind: 'pressure',
          state: 'constrained',
          pressure: 72,
          limit: status.policy.resource_limits.agg_news_queue,
        },
      ],
    })
  );
  render(<WorkloadPage />);
  fireEvent.click(screen.getByRole('button', { name: /Needs attention/ }));
  expect(screen.getByText('News backlog')).toBeInTheDocument();
  expect(screen.queryByText('Text processing')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /All resources/ }));
  expect(screen.getByText('Text processing')).toBeInTheDocument();
});
it('opens unresolved reservations from the overview without carrying an unrelated class or cursor', () => {
  mockParams = 'class=atomize&permits_before=old&verdict=admit';
  (hooks.useWorkloadStatus as jest.Mock).mockReturnValue(
    query({ ...status, summary: { ...status.summary, uncertain_permits: 2 } })
  );
  render(<WorkloadPage />);
  expect(screen.getByText('Unresolved work needs review')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Review reservations' }));
  expect(mockReplace).toHaveBeenCalledWith(
    '/platform/workload?tab=activity&history=permits&state=uncertain',
    { scroll: false }
  );
});
it.each(['invalid-date', '2026-10-20T09:00:00Z'])(
  'treats an invalid or future heartbeat as unverified (%s)',
  (heartbeat_at) => {
    (hooks.useWorkloadStatus as jest.Mock).mockReturnValue(
      query({ ...status, heartbeat_at })
    );
    render(<WorkloadPage />);
    expect(
      screen.getByText('Current capacity cannot be verified')
    ).toBeInTheDocument();
    expect(screen.queryByText('Available')).not.toBeInTheDocument();
  }
);
it('points an empty capacity board to service health instead of suggesting verified capacity', () => {
  (hooks.useWorkloadStatus as jest.Mock).mockReturnValue(
    query({ ...status, resources: [] })
  );
  render(<WorkloadPage />);
  expect(
    screen.getByRole('link', { name: 'Check System Health' })
  ).toHaveAttribute('href', '/platform/system-health');
  expect(
    screen.queryByRole('button', { name: 'Review settings' })
  ).not.toBeInTheDocument();
});
it('preserves a marked settings draft across views until explicitly discarded', () => {
  mockParams = 'tab=settings';
  const view = render(<WorkloadPage />);
  fireEvent.click(screen.getByRole('radio', { name: 'Observe' }));
  expect(
    screen.getByRole('img', { name: 'Unsaved settings' })
  ).toBeInTheDocument();
  mockParams = 'tab=overview';
  view.rerender(<WorkloadPage />);
  expect(
    screen.getByRole('img', { name: 'Unsaved settings' })
  ).toBeInTheDocument();
  mockParams = 'tab=settings';
  view.rerender(<WorkloadPage />);
  expect(screen.getByRole('radio', { name: 'Observe' })).toBeChecked();
  fireEvent.click(screen.getByRole('button', { name: 'Discard draft' }));
  expect(
    screen.queryByRole('img', { name: 'Unsaved settings' })
  ).not.toBeInTheDocument();
  expect(screen.getByRole('radio', { name: 'Off' })).toBeChecked();
  expect(save.mutateAsync).not.toHaveBeenCalled();
});
it('requests only the selected activity history and presents filters for that history', () => {
  mockParams = 'tab=activity';
  const view = render(<WorkloadPage />);
  expect(hooks.useWorkloadDecisions).toHaveBeenLastCalledWith(
    expect.any(Object),
    true
  );
  expect(hooks.useWorkloadPermits).toHaveBeenLastCalledWith(
    expect.any(Object),
    false
  );
  expect(screen.getByLabelText('Decision')).toBeInTheDocument();
  mockParams = 'tab=activity&history=permits';
  view.rerender(<WorkloadPage />);
  expect(hooks.useWorkloadDecisions).toHaveBeenLastCalledWith(
    expect.any(Object),
    false
  );
  expect(hooks.useWorkloadPermits).toHaveBeenLastCalledWith(
    expect.any(Object),
    true
  );
  expect(screen.getByLabelText('Reservation state')).toBeInTheDocument();
  expect(screen.queryByLabelText('Decision')).not.toBeInTheDocument();
});
it('shows overdue owner work without conflating its count with uncertain execution', () => {
  (hooks.useWorkloadStatus as jest.Mock).mockReturnValue(
    query({ ...status, summary: { ...status.summary, overdue_permits: 3 } })
  );
  render(<WorkloadPage />);
  expect(
    screen.getByText(/3 execution reservations are past their lease deadline/)
  ).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: /Unresolved executions/ })
  ).toHaveTextContent('0');
  expect(
    screen.getByRole('button', { name: 'Review reservations' })
  ).toBeInTheDocument();
});
it('shows capacity evidence and the correct Observe next step without claiming delivery success', () => {
  render(<WorkloadPage />);
  expect(
    screen.getByText('Observed resources have capacity')
  ).toBeInTheDocument();
  expect(screen.getByText(/Start Observe to collect/)).toBeInTheDocument();
  expect(screen.getByText(/not affected people/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Review settings' }));
  expect(mockReplace).toHaveBeenCalledWith('/platform/workload?tab=settings', {
    scroll: false,
  });
});
it('marks cached resource evidence stale and locks writes when status fails', () => {
  (hooks.useWorkloadStatus as jest.Mock).mockReturnValue({
    ...query(status),
    isError: true,
    error: new Error('CMS unavailable'),
  });
  render(<WorkloadPage />);
  expect(screen.getByText('Showing last loaded evidence')).toBeInTheDocument();
  expect(
    screen.getByText('Current capacity cannot be verified')
  ).toBeInTheDocument();
  expect(screen.getAllByText('Out of date').length).toBeGreaterThan(0);
  expect(screen.queryByText('Available')).not.toBeInTheDocument();
  expect(
    screen.getByRole('button', {
      name: 'Temporarily bypass admission',
      hidden: true,
    })
  ).toBeDisabled();
});

it('distinguishes unavailable admissions and lost Off journal entries from complete history', () => {
  (hooks.useWorkloadStatus as jest.Mock).mockReturnValue(
    query({ ...status, unavailable_count: 2, disabled_journal_loss: 3 })
  );
  render(<WorkloadPage />);
  expect(
    screen.getByText('Some governor evidence could not be recorded')
  ).toBeInTheDocument();
  expect(
    screen.getByText('Off-mode journal is incomplete')
  ).toBeInTheDocument();
  expect(
    screen.getByText(/database history may omit these operations/)
  ).toBeInTheDocument();
});
it('makes a missing heartbeat unknown and does not convert missing observations to zero', () => {
  (hooks.useWorkloadStatus as jest.Mock).mockReturnValue(
    query({ ...status, heartbeat_at: null, resources: [] })
  );
  render(<WorkloadPage />);
  expect(
    screen.getByText('Heartbeat is missing or out of date')
  ).toBeInTheDocument();
  expect(screen.getByText(/Capacity is unknown/)).toBeInTheDocument();
  expect(
    screen.queryByText('Observed resources have capacity')
  ).not.toBeInTheDocument();
});
it('does not request governor data for a non-administrator', () => {
  (useAuth as jest.Mock).mockReturnValue({
    user: { role: 'editor' },
    isLoading: false,
  });
  render(<WorkloadPage />);
  expect(screen.getByText('Administrator access required')).toBeInTheDocument();
  expect(hooks.useWorkloadStatus).toHaveBeenCalledWith(false);
});
it('retains an explicit settings draft, submits one revisioned update, and never saves on blur', async () => {
  mockParams = 'tab=settings';
  render(<WorkloadPage />);
  fireEvent.click(screen.getByRole('radio', { name: 'Observe' }));
  fireEvent.blur(screen.getByRole('radio', { name: 'Observe' }));
  expect(save.mutateAsync).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Reason for policy change'), {
    target: { value: 'Start the observation qualification window' },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Save admission settings' })
  );
  await waitFor(() => expect(save.mutateAsync).toHaveBeenCalledTimes(1));
  expect(save.mutateAsync).toHaveBeenCalledWith(
    expect.objectContaining({
      revision: 1,
      mode: 'observe',
      review_note: 'Start the observation qualification window',
    })
  );
  await waitFor(() =>
    expect(screen.getByText(/Settings saved/)).toBeInTheDocument()
  );
});
it('preserves drafts on a competing revision and requires discard before retrying', () => {
  mockParams = 'tab=settings';
  const view = render(<WorkloadPage />);
  fireEvent.click(screen.getByRole('radio', { name: 'Observe' }));
  (hooks.useWorkloadStatus as jest.Mock).mockReturnValue(
    query({ ...status, policy: { ...status.policy, revision: 2 } })
  );
  view.rerender(<WorkloadPage />);
  expect(
    screen.getByText('The policy changed while you were editing')
  ).toBeInTheDocument();
  expect(screen.getByRole('radio', { name: 'Observe' })).toBeChecked();
  expect(
    screen.getByRole('button', { name: 'Save admission settings' })
  ).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Discard draft' }));
  expect(screen.getByRole('radio', { name: 'Off' })).toBeChecked();
  expect(
    screen.queryByText('The policy changed while you were editing')
  ).not.toBeInTheDocument();
});
it('binds enforcement to selected qualified classes, the reviewed digest and an exact confirmation', async () => {
  mockParams = 'tab=settings';
  render(<WorkloadPage />);
  fireEvent.click(screen.getByRole('radio', { name: 'Enforce' }));
  fireEvent.click(screen.getByRole('checkbox', { name: /Text embedding/ }));
  fireEvent.change(screen.getByLabelText('Reason for policy change'), {
    target: { value: 'Reviewed settled observations and delivery health' },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Save admission settings' })
  );
  const dialog = screen.getByRole('dialog', {
    name: 'Confirm capacity enforcement',
  });
  expect(within(dialog).getByText(qualification.digest)).toBeInTheDocument();
  expect(save.mutateAsync).not.toHaveBeenCalled();
  const confirm = within(dialog).getByRole('button', {
    name: 'Confirm and save enforcement',
  });
  expect(confirm).toBeDisabled();
  fireEvent.change(
    within(dialog).getByLabelText('Type ENFORCE CAPACITY to confirm'),
    { target: { value: 'ENFORCE CAPACITY' } }
  );
  fireEvent.click(confirm);
  await waitFor(() =>
    expect(save.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'enforce',
        enforced_classes: ['text_embedding'],
        qualification_digest: qualification.digest,
        confirmation: 'ENFORCE CAPACITY',
        revision: 1,
      })
    )
  );
});
it('does not offer selection of a class with insufficient or unavailable qualification', () => {
  mockParams = 'tab=settings';
  (hooks.useWorkloadQualification as jest.Mock).mockReturnValue({
    ...query(qualification),
    isError: true,
  });
  render(<WorkloadPage />);
  fireEvent.click(screen.getByRole('radio', { name: 'Enforce' }));
  expect(
    screen.getByRole('checkbox', { name: /Text embedding/ })
  ).toBeDisabled();
  expect(screen.getByText('Qualification unavailable')).toBeInTheDocument();
});
it('preserves the reviewed draft when the backend rejects stale qualification', async () => {
  mockParams = 'tab=settings';
  save.mutateAsync.mockRejectedValue({
    status: 409,
    message: 'Qualification changed; review current evidence',
  });
  render(<WorkloadPage />);
  fireEvent.click(screen.getByRole('radio', { name: 'Observe' }));
  fireEvent.change(screen.getByLabelText('Reason for policy change'), {
    target: { value: 'Review the governor observation' },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Save admission settings' })
  );
  await waitFor(() =>
    expect(screen.getByText(/Qualification changed/)).toBeInTheDocument()
  );
  expect(screen.getByRole('radio', { name: 'Observe' })).toBeChecked();
  expect(screen.getByText('Unsaved draft')).toBeInTheDocument();
  expect(mockRefresh).toHaveBeenCalled();
});
it('requires a reason for an unstarted permit and trusts the backend revoke capability', async () => {
  mockParams = 'tab=activity&history=permits';
  render(<WorkloadPage />);
  fireEvent.click(screen.getByRole('button', { name: 'Revoke before start' }));
  const dialog = screen.getByRole('dialog', {
    name: 'Revoke an unstarted reservation',
  });
  expect(
    within(dialog).getByRole('button', { name: 'Revoke reservation' })
  ).toBeDisabled();
  fireEvent.change(within(dialog).getByLabelText('Revocation reason'), {
    target: { value: 'Native owner confirms this reservation never started' },
  });
  fireEvent.click(
    within(dialog).getByRole('button', { name: 'Revoke reservation' })
  );
  await waitFor(() =>
    expect(revoke.mutateAsync).toHaveBeenCalledWith({
      id: permit.id,
      reason: 'Native owner confirms this reservation never started',
    })
  );
});
it('does not offer a revoke button for running, handed-off or uncertain work', () => {
  mockParams = 'tab=activity&history=permits';
  (hooks.useWorkloadPermits as jest.Mock).mockReturnValue(
    query({
      data: [
        { ...permit, state: 'running', can_revoke: false },
        { ...permit, id: 'permit-b', state: 'uncertain', can_revoke: false },
      ],
    })
  );
  render(<WorkloadPage />);
  expect(
    screen.queryByRole('button', { name: 'Revoke before start' })
  ).not.toBeInTheDocument();
  expect(
    screen.getByText(/must settle through its native owner/)
  ).toBeInTheDocument();
});
it('preserves Arabic navigation, RTL and operational controls', () => {
  mockParams = 'tab=settings&locale=ar';
  render(<WorkloadPage />);
  expect(
    screen.getByRole('heading', { name: 'العمل والسعة' }).closest('[dir]')
  ).toHaveAttribute('dir', 'rtl');
  expect(
    screen.getByRole('button', { name: 'حفظ إعدادات القبول' })
  ).toBeInTheDocument();
  expect(screen.getByLabelText('سبب تغيير السياسة')).toBeInTheDocument();
});
it('only enables history polling while its view is active', () => {
  render(<WorkloadPage />);
  expect(hooks.useWorkloadDecisions).toHaveBeenCalledWith(
    expect.anything(),
    false
  );
  expect(hooks.useWorkloadPermits).toHaveBeenCalledWith(
    expect.anything(),
    false
  );
  expect(hooks.useWorkloadSnapshots).toHaveBeenCalledWith(
    expect.anything(),
    false
  );
  expect(hooks.useWorkloadQualification).toHaveBeenCalledWith(false);
});

it('requires a bounded, reasoned bypass and binds the reviewed policy revision', async () => {
  mockParams = 'tab=settings';
  const view = render(<WorkloadPage />);
  fireEvent.click(
    screen.getByRole('button', { name: 'Temporarily bypass admission' })
  );
  const dialog = screen.getByRole('dialog', {
    name: 'Temporarily bypass admission',
  });
  expect(
    within(dialog).getByRole('button', { name: 'Start temporary bypass' })
  ).toBeDisabled();
  fireEvent.change(within(dialog).getByLabelText('Bypass reason'), {
    target: { value: 'Temporary owner investigation' },
  });
  fireEvent.change(within(dialog).getByLabelText('Bypass duration'), {
    target: { value: '15' },
  });
  (hooks.useWorkloadStatus as jest.Mock).mockReturnValue(
    query({ ...status, policy: { ...status.policy, revision: 2 } })
  );
  view.rerender(<WorkloadPage />);
  expect(screen.getByText('Policy changed during review')).toBeInTheDocument();
  expect(
    within(dialog).getByRole('button', { name: 'Start temporary bypass' })
  ).toBeDisabled();
  expect(pause.mutateAsync).not.toHaveBeenCalled();
});
it('carries existing class approval forward only with unchanged resource limits', async () => {
  mockParams = 'tab=settings';
  (hooks.useWorkloadStatus as jest.Mock).mockReturnValue(
    query({
      ...status,
      mode: 'enforce',
      policy: {
        ...status.policy,
        mode: 'enforce',
        enforced_classes: ['text_embedding'],
      },
    })
  );
  (hooks.useWorkloadQualification as jest.Mock).mockReturnValue(
    query({
      ...qualification,
      classes: [
        {
          ...qualification.classes[0],
          eligible: false,
          missing: ['insufficient_observed_requests'],
        },
      ],
    })
  );
  render(<WorkloadPage />);
  fireEvent.click(screen.getByText('Resource limits and admission timing'));
  fireEvent.change(screen.getByLabelText('Long wait attention (minutes)'), {
    target: { value: '121' },
  });
  fireEvent.change(screen.getByLabelText('Reason for policy change'), {
    target: {
      value: 'Keep the existing class approval and adjust wait attention',
    },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Save admission settings' })
  );
  expect(
    screen.getByRole('dialog', { name: 'Confirm capacity enforcement' })
  ).toBeInTheDocument();
  expect(save.mutateAsync).not.toHaveBeenCalled();
});
it('rejects invalid numeric drafts without submitting a policy', () => {
  mockParams = 'tab=settings';
  render(<WorkloadPage />);
  fireEvent.click(screen.getByText('Resource limits and admission timing'));
  fireEvent.change(screen.getByLabelText('Reservation lease (seconds)'), {
    target: { value: '' },
  });
  fireEvent.change(screen.getByLabelText('Reason for policy change'), {
    target: { value: 'Review lease setting' },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Save admission settings' })
  );
  expect(screen.getByRole('alert')).toHaveTextContent(
    'whole number between 30–3600'
  );
  expect(save.mutateAsync).not.toHaveBeenCalled();
});
it('renders actual caller use separately from registered governance coverage', () => {
  mockParams = 'tab=evidence';
  (hooks.useWorkloadStatus as jest.Mock).mockReturnValue(
    query({
      ...status,
      coverage: [
        { ...registry.coverage[0], runtime_observed: false, requests_24h: 0 },
      ],
    })
  );
  render(<WorkloadPage />);
  expect(screen.getByText('Not exercised')).toBeInTheDocument();
  expect(screen.getByText('Governor boundary')).toBeInTheDocument();
  expect(
    screen.getByText(/do not prove completion or consumer delivery/)
  ).toBeInTheDocument();
});
it('shows exact incident overlap as contextual evidence and preserves an unavailable input', () => {
  mockParams = 'tab=evidence';
  (hooks.useWorkloadQualification as jest.Mock).mockReturnValue(
    query({
      ...qualification,
      correlation_available: true,
      correlations: [
        {
          incident_id: 'incident-9',
          service: 'enrichment_svc',
          class: 'text_embedding',
          started_at: observedAt,
          decisions: 8,
          would_defer: 3,
          href: '/platform/system-health?tab=incidents&incident=incident-9',
        },
      ],
    })
  );
  const view = render(<WorkloadPage />);
  expect(screen.getByRole('link', { name: 'Review incident' })).toHaveAttribute(
    'href',
    '/platform/system-health?tab=incidents&incident=incident-9'
  );
  expect(
    screen.getByText(/not proof that one caused the other/)
  ).toBeInTheDocument();
  expect(
    screen.getByText(/3 would-defer decisions among 8/)
  ).toBeInTheDocument();
  (hooks.useWorkloadQualification as jest.Mock).mockReturnValue(
    query({
      ...qualification,
      correlation_available: false,
      correlation_reason: 'incident_store_unavailable',
      correlations: [],
    })
  );
  view.rerender(<WorkloadPage />);
  expect(
    screen.getByText('Incident overlap evidence unavailable')
  ).toBeInTheDocument();
  expect(
    screen.queryByText('No matching incident overlap recorded')
  ).not.toBeInTheDocument();
});
it('shows explicit no-overlap evidence without declaring delivery healthy', () => {
  mockParams = 'tab=evidence';
  (hooks.useWorkloadQualification as jest.Mock).mockReturnValue(
    query({ ...qualification, correlation_available: true, correlations: [] })
  );
  render(<WorkloadPage />);
  expect(
    screen.getByText('No matching incident overlap recorded')
  ).toBeInTheDocument();
  expect(
    screen.getByText(
      'This does not establish available capacity or healthy delivery.'
    )
  ).toBeInTheDocument();
});
