import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PodsPipelineControl } from './pods-pipeline-control';
import {
  getPodsAutomation,
  setPodsAutomation,
  getPodsPipelineActivity,
  type PodsAutomationStatus,
} from '@/lib/api/cms/pods-automation';

jest.mock('@/lib/api/cms/pods-automation', () => ({
  getPodsAutomation: jest.fn(),
  setPodsAutomation: jest.fn(),
  getPodsPipelineActivity: jest.fn(),
}));
jest.mock('@/components/ui/toast', () => ({ toast: jest.fn() }));

const status: PodsAutomationStatus = {
  activity: {
    running_steps: 1,
    claimed_steps: 0,
    verifying_steps: 0,
    unresolved_steps: 0,
    queued_steps: 7,
    running_source_runs: 0,
    admitted_source_runs: 0,
    verifying_source_runs: 0,
    queued_source_runs: 0,
  },
  paused: false,
  version: 'control-v1',
  environment: 'local',
  tenant_id: 'default',
  can_manage: true,
  ready: true,
  active_sources: 2,
  active_steps: 1,
  active_source_runs: 0,
  queued_steps: 7,
  processing_mode: 'automatic',
  automatic_source_overrides: 0,
  auto_publish: true,
  chaptering_enabled: true,
  updated_at: '2026-11-03T12:00:00Z',
  updated_by: 'admin',
};
function mount(compact = false) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <PodsPipelineControl compact={compact} />
    </QueryClientProvider>
  );
}

describe('Pods pipeline control', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (getPodsAutomation as jest.Mock).mockResolvedValue(status);
    (getPodsPipelineActivity as jest.Mock).mockResolvedValue({
      items: [],
      next_cursor: '',
      observed_at: '2026-11-03T12:00:00Z',
    });
    (setPodsAutomation as jest.Mock).mockResolvedValue({
      ...status,
      paused: true,
      version: 'control-v2',
    });
  });
  it('pauses all pipeline boundaries through one version-bound owner change', async () => {
    mount();
    const pause = await screen.findByRole('button', { name: 'Pause pipeline' });
    await waitFor(() => expect(pause).toBeEnabled());
    fireEvent.click(pause);
    await waitFor(() =>
      expect(setPodsAutomation).toHaveBeenCalledWith(true, 'control-v1')
    );
    expect(
      await screen.findByRole('button', { name: 'Resume pipeline' })
    ).toBeEnabled();
    expect(
      screen.getByText(
        'New source runs, processing, and publication are held until resumed. Manual processing also waits.'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(/A step already executing may finish/)
    ).toBeInTheDocument();
  });
  it('reviews queued work and automatic publication before resuming', async () => {
    (getPodsAutomation as jest.Mock).mockResolvedValue({
      ...status,
      paused: true,
    });
    (setPodsAutomation as jest.Mock).mockResolvedValue({
      ...status,
      version: 'control-v2',
    });
    mount();
    fireEvent.click(
      await screen.findByRole('button', { name: 'Resume pipeline' })
    );
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('7 queued processing steps can continue.');
    expect(dialog).toHaveTextContent(
      'Eligible chapters may publish without another confirmation.'
    );
    expect(setPodsAutomation).not.toHaveBeenCalled();
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Resume pipeline' })
    );
    await waitFor(() =>
      expect(setPodsAutomation).toHaveBeenCalledWith(false, 'control-v1')
    );
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    );
  });
  it('cancels a resume without changing policy or enabling sources', async () => {
    (getPodsAutomation as jest.Mock).mockResolvedValue({
      ...status,
      paused: true,
    });
    mount();
    fireEvent.click(
      await screen.findByRole('button', { name: 'Resume pipeline' })
    );
    fireEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: 'Cancel',
      })
    );
    expect(setPodsAutomation).not.toHaveBeenCalled();
  });
  it('does not report an unknown state as enabled or paused', async () => {
    (getPodsAutomation as jest.Mock).mockRejectedValue({
      message: 'Unavailable',
    });
    mount();
    expect(
      await screen.findByRole('button', { name: 'Refresh status' })
    ).toBeEnabled();
    expect(screen.getAllByRole('status')[0]).toHaveTextContent(
      'Status unavailable'
    );
    expect(
      screen.queryByRole('button', { name: 'Pause pipeline' })
    ).not.toBeInTheDocument();
    expect(setPodsAutomation).not.toHaveBeenCalled();
  });
  it('reconciles a lost acknowledgement by reading without replaying the command', async () => {
    (setPodsAutomation as jest.Mock).mockRejectedValue({
      message: 'Connection lost',
      status: 0,
    });
    mount();
    const button = await screen.findByRole('button', {
      name: 'Pause pipeline',
    });
    await waitFor(() => expect(button).toBeEnabled());
    (getPodsAutomation as jest.Mock).mockResolvedValue({
      ...status,
      paused: true,
      version: 'control-v2',
    });
    fireEvent.click(button);
    expect(
      await screen.findByRole('button', { name: 'Resume pipeline' })
    ).toBeEnabled();
    expect(setPodsAutomation).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  it('keeps read-only and unprovisioned controls disabled', async () => {
    (getPodsAutomation as jest.Mock).mockResolvedValue({
      ...status,
      can_manage: false,
    });
    const view = mount();
    expect(
      await screen.findByRole('button', { name: 'Pause pipeline' })
    ).toBeDisabled();
    view.unmount();
    (getPodsAutomation as jest.Mock).mockResolvedValue({
      ...status,
      paused: true,
      ready: false,
    });
    mount();
    expect(
      await screen.findByRole('link', { name: 'Review setup' })
    ).toBeInTheDocument();
  });
  it('provides one canonical controls link from Studio and the Library', async () => {
    mount(true);
    expect(
      await screen.findByRole('link', { name: 'Pipeline controls' })
    ).toHaveAttribute('href', '/platform/media/sources#pods-pipeline');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
  it('distinguishes paused work that is still running from idle work', async () => {
    (getPodsAutomation as jest.Mock).mockResolvedValue({
      ...status,
      paused: true,
    });
    mount();
    expect(
      await screen.findByText('Processing steps running: 1')
    ).toBeInTheDocument();
    expect(screen.getAllByRole('status')[0]).toHaveTextContent('Paused');
    expect(screen.queryByText('No active processing')).not.toBeInTheDocument();
  });
  it('requires a new review when policy changes before resume and never sends the old command', async () => {
    (getPodsAutomation as jest.Mock).mockResolvedValue({
      ...status,
      paused: true,
    });
    mount();
    fireEvent.click(
      await screen.findByRole('button', { name: 'Resume pipeline' })
    );
    const dialog = await screen.findByRole('dialog');
    (getPodsAutomation as jest.Mock).mockResolvedValue({
      ...status,
      paused: true,
      auto_publish: false,
    });
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Resume pipeline' })
    );
    expect(
      await within(dialog).findByRole('button', { name: 'Refresh review' })
    ).toBeEnabled();
    expect(dialog).toHaveTextContent('Scope or settings changed.');
    expect(setPodsAutomation).not.toHaveBeenCalled();
  });
  it('does not turn a definitive permission rejection into success', async () => {
    (setPodsAutomation as jest.Mock).mockRejectedValue({
      status: 403,
      message: 'Insufficient role',
    });
    mount();
    const pause = await screen.findByRole('button', { name: 'Pause pipeline' });
    await waitFor(() => expect(pause).toBeEnabled());
    fireEvent.click(pause);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Insufficient role'
    );
    expect(setPodsAutomation).toHaveBeenCalledTimes(1);
  });
  it('loads activity on demand and does not infer a publication actor', async () => {
    (getPodsPipelineActivity as jest.Mock).mockResolvedValue({
      items: [
        {
          id: 'source-event',
          kind: 'source_run',
          title: 'Podcast',
          trigger: 'schedule',
          outcome: 'succeeded',
          event_at: status.updated_at,
        },
        {
          id: 'publication-event',
          kind: 'publication',
          title: 'Episode',
          trigger: 'unrecorded',
          outcome: 'active',
          event_at: status.updated_at,
          units: 3,
        },
      ],
      next_cursor: '',
      observed_at: status.updated_at,
    });
    mount();
    await screen.findByRole('button', { name: 'View activity' });
    expect(getPodsPipelineActivity).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'View activity' }));
    const sheet = await screen.findByRole('dialog', {
      name: 'Pods pipeline activity',
    });
    expect(
      await within(sheet).findByText(
        'Requested automatically · Source schedule'
      )
    ).toBeInTheDocument();
    expect(
      within(sheet).getByText('Publication origin not recorded')
    ).toBeInTheDocument();
    expect(
      within(sheet).queryByText(/Recorded requester/)
    ).not.toBeInTheDocument();
  });
  it('provides the same pause and manual scope in Arabic', async () => {
    (getPodsAutomation as jest.Mock).mockResolvedValue({
      ...status,
      paused: true,
    });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <PodsPipelineControl locale="ar" />
      </QueryClientProvider>
    );
    expect(
      await screen.findByRole('button', { name: 'استئناف المسار' })
    ).toBeEnabled();
    expect(
      screen.getByText(/المعالجة اليدوية تنتظر أيضاً/)
    ).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'مسار بودز' })).toHaveAttribute(
      'dir',
      'rtl'
    );
  });
  it('retains last-confirmed facts after a failed refresh without presenting them as current', async () => {
    (getPodsAutomation as jest.Mock).mockRejectedValue({
      status: 503,
      message: 'Unavailable',
    });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    client.setQueryData(
      ['pods-automation'],
      { ...status, paused: true },
      { updatedAt: Date.now() - 61_000 }
    );
    render(
      <QueryClientProvider client={client}>
        <PodsPipelineControl />
      </QueryClientProvider>
    );
    expect(
      await screen.findByRole('button', { name: 'Refresh status' })
    ).toBeEnabled();
    expect(screen.getAllByRole('status')[0]).toHaveTextContent(
      'Status unavailable'
    );
    expect(screen.getByText(/Last confirmed: Paused/)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Resume pipeline' })
    ).not.toBeInTheDocument();
  });
});
