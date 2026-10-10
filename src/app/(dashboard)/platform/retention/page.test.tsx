import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cmsClient } from '@/lib/api/client';
import RetentionPage from './page';

jest.mock('@/lib/api/client', () => ({ cmsClient: { get: jest.fn(), post: jest.fn(), put: jest.fn() } }));
jest.mock('@/components/operator/operator-launch-link', () => ({ OperatorLaunchLink: () => null }));
jest.mock('@/components/ui/toast', () => ({ toast: jest.fn() }));
const runID = '11111111-1111-4111-8111-111111111111';
const actionID = '22222222-2222-4222-8222-222222222222';
const retireID = '33333333-3333-4333-8333-333333333333';
const leadID = '44444444-4444-4444-8444-444444444444';
const savedRun = { id: runID, trigger: 'manual', mode: 'assist', status: 'completed', verdict: 'healthy', policy_version: 3, started_at: '2026-10-01T00:00:00Z' };
const manifest = { id: 'frozen', manifest_hash: 'a'.repeat(64), state: 'prepared', policy_version: 3, timezone: 'Asia/Riyadh', expires_at: '2080-01-01T00:00:00Z', story_ids: ['story-original'], anchor_content_ids: [leadID], protected_content_ids: [], retire_content_ids: [retireID], evidence: { stories: [{ story_id: 'story-original', lead_id: leadID, representative_ids: [], protected_ids: [], retire_ids: [retireID] }] } };
let action: Record<string, unknown>;
let latest: string;
let reviewUnavailable: boolean;
let policyMode: string;
let statusOverrides: Record<string, unknown>;
let historyDetails: Record<string, unknown>;
let savedPolicy: Record<string, unknown>;
let savedControls: Record<string, unknown>;
let client: QueryClient;
beforeEach(() => {
  jest.clearAllMocks(); latest = 'new-observation'; reviewUnavailable = false; policyMode = 'assist';
  statusOverrides = {}; historyDetails = {};
  savedControls = { canonical_compaction_enabled: false, historical_enabled: false, feed_recovery_rotate_enabled: false };
  savedPolicy = { enabled: true, mode: policyMode, news_timezone: 'Asia/Riyadh', policy_version: 3,
    database_target_bytes: 400 * 1048576, database_warning_bytes: 400 * 1048576,
    database_action_bytes: 440 * 1048576, database_critical_bytes: 480 * 1048576,
    schedule_interval_minutes: 360, max_rows_per_run: 500, max_bytes_per_run: 32 * 1048576 };
  action = { id: actionID, action_class: 'news_database.prepare_compaction', outcome: 'approval_required', manifest_hash: manifest.manifest_hash, target_count: 1, estimated_bytes: 100 };
  window.history.replaceState(null, '', '/platform/retention');
  jest.mocked(cmsClient.get).mockImplementation(async (url) => {
    if (url.endsWith('/status')) return { data: { policy: { ...savedPolicy, mode: policyMode }, latest_run: { ...savedRun, id: latest }, forecast: {}, preview: { candidate_rows: 1 }, guarantees: {}, execution_controls: savedControls, ...statusOverrides } };
    if (url.endsWith('/runs')) return { data: { items: [{ ...savedRun, ...historyDetails }] } };
    if (url.endsWith(`/runs/${runID}`)) return { data: savedRun };
    if (url.endsWith(`/runs/${runID}/actions`)) return { data: { items: [{ ...action }] } };
    if (url.endsWith(`/actions/${actionID}/review`)) {
      if (reviewUnavailable) throw new Error('Manifest evidence unavailable');
      return { data: { action_id: actionID, run_id: runID, action_class: action.action_class, outcome: action.outcome, manifest } };
    }
    if (url.endsWith('/monthly-review/policy')) return { data: { version: 1, config: {} } };
    return { data: { items: [] } };
  });
  jest.mocked(cmsClient.post).mockImplementation(async (url) => {
    if (url.endsWith('/compaction/prepare')) return { data: { ...manifest, run_id: runID, action_id: actionID } };
    if (url.endsWith('/approve')) { action.outcome = 'approved'; return { data: { ...action } }; }
    return { data: { ...action, outcome: 'verified' } };
  });
  jest.mocked(cmsClient.put).mockImplementation(async (_url, patch) => {
    if (_url.endsWith('/execution-controls')) { savedControls = { ...savedControls, ...patch }; return { data: savedControls }; }
    savedPolicy = { ...savedPolicy, ...patch, policy_version: Number(savedPolicy.policy_version) + 1 };
    const policyPatch = patch as { mode?: string } | undefined;
    if (policyPatch?.mode) policyMode = policyPatch.mode;
    return { data: savedPolicy };
  });
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
});
afterEach(() => { cleanup(); client.clear(); });
function mount() { return render(<QueryClientProvider client={client}><RetentionPage /></QueryClientProvider>); }

it('requires exact review before approval and keeps selected saved work across a new observation and reload', async () => {
  const user = userEvent.setup(); const view = mount();
  await user.click(await screen.findByRole('button', { name: 'Open run' }));
  expect(await screen.findByRole('button', { name: 'Approve cleanup plan' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'Review cleanup plan' }));
  await screen.findByText(retireID, { exact: true });
  expect(screen.getByText(leadID, { exact: true })).toBeInTheDocument();
  expect(screen.getByText('Hash ' + manifest.manifest_hash)).toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Approve cleanup plan' })).toBeEnabled());
  latest = 'even-newer-observation'; await client.invalidateQueries({ queryKey: ['retention', 'status'] });
  expect(window.location.search).toContain(`run=${runID}`);
  expect(window.location.search).toContain(`action=${actionID}`);
  expect(cmsClient.get).not.toHaveBeenCalledWith('/admin/retention/runs/even-newer-observation/actions');
  await user.click(screen.getByRole('button', { name: 'Approve cleanup plan' }));
  expect(cmsClient.post).toHaveBeenCalledWith(`/admin/retention/actions/${actionID}/approve`, {});
  view.unmount(); mount(); await screen.findByText(retireID, { exact: true });
});

it('opens the exact action returned by preparation', async () => {
  const user = userEvent.setup(); mount();
  await user.click(await screen.findByRole('button', { name: 'Prepare current-month plan' }));
  await screen.findByText('Frozen manifest frozen');
  expect(window.location.search).toBe(`?run=${runID}&action=${actionID}`);
  expect(cmsClient.post).toHaveBeenCalledWith('/admin/retention/compaction/prepare', {});
});

it('blocks approval when exact review fails', async () => {
  reviewUnavailable = true; window.history.replaceState(null, '', `/platform/retention?run=${runID}&action=${actionID}`); mount();
  await screen.findByRole('alert');
  expect(await screen.findByRole('button', { name: 'Approve cleanup plan' })).toBeDisabled();
  expect(cmsClient.post).not.toHaveBeenCalled();
});

it('retries historical verification on the original action with expired evidence and Observe policy', async () => {
  action.action_class = 'news_database.execute_historical_purge'; action.outcome = 'verification_failed'; policyMode = 'observe';
  savedControls.historical_enabled = true;
  const expiry = manifest.expires_at; manifest.expires_at = '2020-01-01T00:00:00Z';
  window.history.replaceState(null, '', `/platform/retention?run=${runID}&action=${actionID}`);
  const user = userEvent.setup(); mount();
  try {
    await waitFor(() => expect(screen.getByRole('button', { name: 'Retry verification' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Retry verification' }));
    expect(cmsClient.post).toHaveBeenCalledTimes(1);
    expect(cmsClient.post).toHaveBeenCalledWith(`/admin/retention/historical/actions/${actionID}/execute`, {});
    expect(window.location.search).toContain(actionID);
  } finally { manifest.expires_at = expiry; }
});

it('offers explicit manual modes and native owner links for a saved Safe Auto policy', async () => {
  policyMode = 'safe_auto'; mount();
  await screen.findByText(/Saved Safe Auto policy is inactive/);
  expect(screen.queryByRole('option', { name: 'Safe Auto' })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Storage' })).toHaveAttribute('href', '/platform/storage');
  expect(screen.getByRole('link', { name: 'Media Circulation' })).toHaveAttribute('href', '/platform/media/circulation');
  expect(screen.queryByRole('button', { name: /Reset breaker|Request Storage|Execute owner/ })).not.toBeInTheDocument();
});

it('shows critical pressure independently of maintenance and leaves insufficient-history growth unavailable', async () => {
  statusOverrides = { capacity_verdict: 'critical', verdict: 'compaction_due', latest_sample: { database_bytes: 895 * 1024 * 1024 }, forecast: { sample_count: 4, window_hours: 0.5, growth_bytes_per_day: 0 } };
  mount();
  await screen.findByText('The critical line has already been crossed.');
  expect(screen.getByText('Maintenance: compaction_due')).toBeInTheDocument();
  expect(screen.getByText('Growth / day').parentElement).toHaveTextContent('Unavailable');
  expect(screen.getByText('Protection').parentElement).toHaveTextContent('Checked during preparation');
  expect(screen.getByText('Inspected rows')).toBeInTheDocument();
  expect(screen.queryByText('Protected rows')).not.toBeInTheDocument();
});

it('explains the minimum sample window and displays the saved preparation failure', async () => {
  statusOverrides = { latest_sample: { database_bytes: 390 * 1024 * 1024 }, forecast: { sample_count: 2, window_hours: 0.18, growth_bytes_per_day: 0 } };
  historyDetails = { after_evidence: { operation: 'Historical preparation' }, error: 'no archive-gated, unprotected historical News is eligible' };
  mount();
  await screen.findByText('Growth needs at least two samples spanning one hour.');
  expect(screen.getByText('Historical preparation · manual · policy v3')).toBeInTheDocument();
  expect(screen.getByText(String(historyDetails.error))).toBeInTheDocument();
  expect(screen.getByText('Growth / day').parentElement).toHaveTextContent('Unavailable');
});

it('saves edited capacity, cadence and cleanup limits in bytes without arming execution or changing protections', async () => {
  policyMode = 'observe'; savedPolicy.enabled = false;
  const user = userEvent.setup(); const view = mount();
  await screen.findByDisplayValue('480');
  expect(screen.getByRole('button', { name: 'Save policy' })).toBeDisabled();
  for (const [label, value] of [['Working target (MiB)', '600'], ['Warning threshold (MiB)', '650'], ['Action threshold (MiB)', '700'], ['Critical threshold (MiB)', '800'], ['Observation interval (minutes)', '120'], ['Maximum rows per cleanup', '250'], ['Maximum estimated cleanup (MiB)', '16']]) {
    const input = screen.getByRole('spinbutton', { name: label });
    await user.clear(input); await user.type(input, value);
  }
  await client.invalidateQueries({ queryKey: ['retention', 'status'] });
  expect(screen.getByRole('spinbutton', { name: 'Critical threshold (MiB)' })).toHaveValue(800);
  await user.click(screen.getByRole('button', { name: 'Save policy' }));
  await waitFor(() => expect(cmsClient.put).toHaveBeenCalledWith('/admin/retention/policy', {
    database_target_bytes: 600 * 1048576, database_warning_bytes: 650 * 1048576,
    database_action_bytes: 700 * 1048576, database_critical_bytes: 800 * 1048576,
    schedule_interval_minutes: 120, max_rows_per_run: 250, max_bytes_per_run: 16 * 1048576,
  }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save policy' })).toBeDisabled());
  view.unmount(); mount();
  await waitFor(() => expect(screen.getByRole('spinbutton', { name: 'Critical threshold (MiB)' })).toHaveValue(800));
  expect(screen.getByRole('switch', { name: 'Retention enabled' })).not.toBeChecked();
  expect(cmsClient.post).not.toHaveBeenCalled();
});

it.each([
  ['Critical threshold (MiB)', '440', 'Capacity levels'],
  ['Working target (MiB)', '0', 'whole number'],
  ['Observation interval (minutes)', '14', '15 to 10080'],
  ['Observation interval (minutes)', '10081', '15 to 10080'],
  ['Maximum rows per cleanup', '10001', '1 to 10000'],
  ['Maximum rows per cleanup', '1.5', 'whole number'],
  ['Maximum estimated cleanup (MiB)', '', 'whole number'],
  ['Critical threshold (MiB)', '99999999999999999', 'whole number'],
])('blocks invalid %s=%s and allows discarding edits', async (label, value, message) => {
  const user = userEvent.setup(); mount();
  await screen.findByDisplayValue('480');
  const input = screen.getByRole('spinbutton', { name: label });
  await user.clear(input); if (value) await user.type(input, value);
  expect(screen.getByRole('alert')).toHaveTextContent(message);
  expect(screen.getByRole('button', { name: 'Save policy' })).toBeDisabled();
  expect(cmsClient.put).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Discard' }));
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByRole('spinbutton', { name: 'Critical threshold (MiB)' })).toHaveValue(480);
});

it('keeps unsaved edits visible when the policy API rejects a save', async () => {
  jest.mocked(cmsClient.put).mockRejectedValue(new Error('Policy write failed'));
  const user = userEvent.setup(); mount();
  const input = await screen.findByRole('spinbutton', { name: 'Critical threshold (MiB)' });
  await waitFor(() => expect(input).toHaveValue(480));
  await user.clear(input); await user.type(input, '600');
  await user.click(screen.getByRole('button', { name: 'Save policy' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Policy write failed');
  expect(input).toHaveValue(600);
  expect(screen.getByRole('button', { name: 'Save policy' })).toBeEnabled();
  await user.click(screen.getByRole('button', { name: 'Discard' }));
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(input).toHaveValue(480);
});

it('shows an ordered flow and a truthful execution-disabled state before any cleanup is selected', async () => {
  policyMode = 'observe'; savedPolicy.enabled = false;
  mount();
  await screen.findByRole('heading', { name: 'Measure the database first' });
  expect(screen.getByRole('link', { name: 'Observe' })).toHaveAttribute('aria-current', 'step');
  expect(screen.getByRole('link', { name: 'Execution settings' })).toHaveAttribute('href', '#execution-settings');
  expect(screen.getByText('New cleanup execution disabled')).toBeInTheDocument();
  expect(screen.getByText(/No cleanup selected/)).toBeInTheDocument();
  expect(cmsClient.put).not.toHaveBeenCalled(); expect(cmsClient.post).not.toHaveBeenCalled();
});

it('moves from measured capacity to preparation and explains the missing historical archive', async () => {
  statusOverrides = { latest_sample: { database_bytes: 600 * 1048576 }, historical: { finalized_archives: 0 } };
  mount();
  await screen.findByRole('heading', { name: 'Choose a cleanup to prepare' });
  expect(screen.getByRole('link', { name: 'Prepare' })).toHaveAttribute('aria-current', 'step');
  expect(screen.getByRole('button', { name: 'Prepare archived-month plan' })).toBeDisabled();
  expect(screen.getByRole('link', { name: 'Build and verify Month in Review' })).toHaveAttribute('href', '#monthly-archive');
});

it('reports the matching execution gate even when Assist and Retention are already enabled', async () => {
  action.outcome = 'approved'; savedControls.historical_enabled = true;
  window.history.replaceState(null, '', `/platform/retention?run=${runID}&action=${actionID}`);
  mount();
  await screen.findByRole('heading', { name: 'Approved · execution is blocked' });
  expect(screen.getByText('Enable “Allow current-month cleanup” in Execution settings.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Execute approved cleanup' })).toBeDisabled();
  expect(cmsClient.post).not.toHaveBeenCalled();
});

it('saves explicit execution settings with an audit reason, preserves numeric drafts and never starts cleanup', async () => {
  policyMode = 'observe'; savedPolicy.enabled = false;
  const user = userEvent.setup(); mount();
  await screen.findByDisplayValue('480');
  await user.clear(screen.getByRole('spinbutton', { name: 'Critical threshold (MiB)' }));
  await user.type(screen.getByRole('spinbutton', { name: 'Critical threshold (MiB)' }), '600');
  await user.click(screen.getByRole('switch', { name: 'Retention enabled' }));
  await user.selectOptions(screen.getByRole('combobox', { name: /Operating mode/ }), 'assist');
  await user.click(screen.getByRole('switch', { name: 'Allow current-month cleanup' }));
  expect(screen.getByRole('button', { name: 'Save execution settings' })).toBeDisabled();
  await user.type(screen.getByRole('textbox', { name: 'Reason for execution settings' }), 'Reviewed cleanup rollout');
  await client.invalidateQueries({ queryKey: ['retention', 'status'] });
  expect(screen.getByText('New cleanup execution disabled')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Save execution settings' }));
  await waitFor(() => expect(screen.getByText('Reviewed cleanup enabled')).toBeInTheDocument());
  expect(cmsClient.put).toHaveBeenNthCalledWith(1, '/admin/retention/execution-controls', { canonical_compaction_enabled: true, reason: 'Reviewed cleanup rollout' });
  expect(cmsClient.put).toHaveBeenNthCalledWith(2, '/admin/retention/policy', { enabled: true, mode: 'assist' });
  expect(screen.getByRole('switch', { name: 'Allow archived-month cleanup' })).not.toBeChecked();
  expect(screen.getByRole('spinbutton', { name: 'Critical threshold (MiB)' })).toHaveValue(600);
  expect(cmsClient.post).not.toHaveBeenCalled();
});

it('keeps partially saved execution settings explicit and blocks cleanup until policy enablement succeeds', async () => {
  policyMode = 'observe'; savedPolicy.enabled = false; action.outcome = 'approved';
  window.history.replaceState(null, '', `/platform/retention?run=${runID}&action=${actionID}`);
  const normalPut = jest.mocked(cmsClient.put).getMockImplementation()!;
  jest.mocked(cmsClient.put).mockImplementation(async (url, patch) => {
    if (url.endsWith('/policy')) throw new Error('Policy write failed');
    return normalPut(url, patch);
  });
  const user = userEvent.setup(); mount();
  await screen.findByRole('heading', { name: 'Approved · execution is blocked' });
  await user.click(screen.getByRole('switch', { name: 'Retention enabled' }));
  await user.selectOptions(screen.getByRole('combobox', { name: /Operating mode/ }), 'assist');
  await user.click(screen.getByRole('switch', { name: 'Allow current-month cleanup' }));
  await user.type(screen.getByRole('textbox', { name: 'Reason for execution settings' }), 'Reviewed cleanup rollout');
  await user.click(screen.getByRole('button', { name: 'Save execution settings' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('not fully saved: Policy write failed');
  expect(screen.getByRole('button', { name: 'Execute approved cleanup' })).toBeDisabled();
  expect(screen.getByRole('switch', { name: 'Retention enabled' })).toBeChecked(); // Unsaved draft.
  expect(screen.getByRole('textbox', { name: 'Reason for execution settings' })).toHaveValue('Reviewed cleanup rollout');
  expect(screen.getByText('New cleanup execution disabled')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Discard execution edits' }));
  expect(screen.getByRole('switch', { name: 'Retention enabled' })).not.toBeChecked();
  expect(screen.getByRole('switch', { name: 'Allow current-month cleanup' })).toBeChecked(); // Persisted first API.
  expect(cmsClient.post).not.toHaveBeenCalled();
});

it('retains the activation draft after an administrator control rejection and does not update policy', async () => {
  jest.mocked(cmsClient.put).mockRejectedValue(new Error('administrator role required'));
  const user = userEvent.setup(); mount(); await screen.findByDisplayValue('480');
  await user.click(screen.getByRole('switch', { name: 'Allow current-month cleanup' }));
  await user.type(screen.getByRole('textbox', { name: 'Reason for execution settings' }), 'Reviewed cleanup rollout');
  await user.click(screen.getByRole('button', { name: 'Save execution settings' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('administrator role required');
  expect(screen.getByRole('switch', { name: 'Allow current-month cleanup' })).toBeChecked();
  expect(screen.getByText('New cleanup execution disabled')).toBeInTheDocument();
  expect(cmsClient.put).toHaveBeenCalledTimes(1); expect(cmsClient.post).not.toHaveBeenCalled();
});

it('executes only the reviewed approved cleanup after a separate confirmation', async () => {
  action.outcome = 'approved'; savedControls.canonical_compaction_enabled = true;
  window.history.replaceState(null, '', `/platform/retention?run=${runID}&action=${actionID}`);
  const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false);
  const user = userEvent.setup(); mount();
  try {
    await screen.findByRole('heading', { name: 'Approved · ready to execute' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Execute approved cleanup' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Execute approved cleanup' }));
    expect(cmsClient.post).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    await user.click(screen.getByRole('button', { name: 'Execute approved cleanup' }));
    expect(cmsClient.post).toHaveBeenCalledTimes(1);
    expect(cmsClient.post).toHaveBeenCalledWith(`/admin/retention/actions/${actionID}/execute`, {});
  } finally { confirm.mockRestore(); }
});

it('shows committed cleanup at verification and explains a disabled matching gate without offering re-execution', async () => {
  action.outcome = 'verification_failed'; policyMode = 'observe'; savedPolicy.enabled = false;
  window.history.replaceState(null, '', `/platform/retention?run=${runID}&action=${actionID}`);
  mount(); await screen.findByRole('heading', { name: 'Verification needs attention' });
  expect(screen.getByRole('link', { name: 'Verify' })).toHaveAttribute('aria-current', 'step');
  expect(screen.getByText(/without deleting the rows again/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Retry verification' })).toBeDisabled();
  expect(screen.queryByRole('button', { name: 'Execute approved cleanup' })).not.toBeInTheDocument();
  expect(screen.queryByText('Choose Assist in Execution settings.')).not.toBeInTheDocument();
});

it('shows verified completion and sends the next action to measurement', async () => {
  action.outcome = 'verification_passed';
  window.history.replaceState(null, '', `/platform/retention?run=${runID}&action=${actionID}`);
  mount(); await screen.findByRole('heading', { name: 'Cleanup verified' });
  expect(screen.getByRole('link', { name: 'Go to observation' })).toHaveAttribute('href', '#database-measurements');
  expect(screen.queryByRole('button', { name: /Execute approved|Retry verification/ })).not.toBeInTheDocument();
});

it('returns expired approval to preparation instead of showing it as ready to execute', async () => {
  action.outcome = 'approved'; savedControls.canonical_compaction_enabled = true;
  const expiry = manifest.expires_at; manifest.expires_at = '2020-01-01T00:00:00Z';
  window.history.replaceState(null, '', `/platform/retention?run=${runID}&action=${actionID}`);
  try {
    mount(); await screen.findByRole('heading', { name: 'A new cleanup plan is required' });
    expect(screen.getByRole('link', { name: 'Prepare' })).toHaveAttribute('aria-current', 'step');
    expect(screen.getByRole('button', { name: 'Execute approved cleanup' })).toBeDisabled();
    expect(cmsClient.post).not.toHaveBeenCalled();
  } finally { manifest.expires_at = expiry; }
});

it('shows the saved verification error directly with its native owner link', async () => {
  action.outcome = 'verification_failed'; action.verification = { phase: 'readback', error: 'feed integrity verification: feed integrity run already running' };
  window.history.replaceState(null, '', `/platform/retention?run=${runID}&action=${actionID}`);
  mount();
  expect(await screen.findByText(/Last check: feed integrity verification/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Inspect Feed Integrity' })).toHaveAttribute('href', '/platform/feed-integrity');
});

it('shows preparation failure persistently without losing the previous selected cleanup', async () => {
  action.outcome = 'verification_failed';
  window.history.replaceState(null, '', `/platform/retention?run=${runID}&action=${actionID}`);
  jest.mocked(cmsClient.post).mockRejectedValue(new Error('no eligible candidates after preflight'));
  const user = userEvent.setup(); mount();
  await screen.findByRole('heading', { name: 'Verification needs attention' });
  await user.click(screen.getByRole('button', { name: 'Prepare current-month plan' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Plan preparation failed: no eligible candidates after preflight');
  expect(window.location.search).toContain(actionID);
  expect(screen.getByRole('heading', { name: 'Verification needs attention' })).toBeInTheDocument();
});

it('disables policy before enabling another cleanup gate and reports partial failure truthfully', async () => {
  const normalPut = jest.mocked(cmsClient.put).getMockImplementation()!;
  jest.mocked(cmsClient.put).mockImplementation(async (url, patch) => {
    if (url.endsWith('/execution-controls')) throw new Error('Control write failed');
    return normalPut(url, patch);
  });
  const user = userEvent.setup(); mount(); await screen.findByDisplayValue('480');
  await user.selectOptions(screen.getByRole('combobox', { name: /Operating mode/ }), 'observe');
  await user.click(screen.getByRole('switch', { name: 'Allow archived-month cleanup' }));
  await user.type(screen.getByRole('textbox', { name: 'Reason for execution settings' }), 'Disable new cleanup');
  await user.click(screen.getByRole('button', { name: 'Save execution settings' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Control write failed');
  expect(cmsClient.put).toHaveBeenNthCalledWith(1, '/admin/retention/policy', { mode: 'observe' });
  expect(cmsClient.put).toHaveBeenNthCalledWith(2, '/admin/retention/execution-controls', { historical_enabled: true, reason: 'Disable new cleanup' });
  expect(screen.getByText('New cleanup execution disabled')).toBeInTheDocument();
  expect(cmsClient.post).not.toHaveBeenCalled();
});

it('shows an in-progress saved execution without offering another execution or approval', async () => {
  action.outcome = 'running';
  window.history.replaceState(null, '', `/platform/retention?run=${runID}&action=${actionID}`);
  mount(); await screen.findByRole('heading', { name: 'Cleanup execution in progress' });
  expect(screen.getByRole('link', { name: 'Enable & execute' })).toHaveAttribute('aria-current', 'step');
  expect(screen.queryByRole('button', { name: /Execute approved|Approve cleanup/ })).not.toBeInTheDocument();
});
