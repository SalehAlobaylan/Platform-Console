import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cmsClient, iamClient } from '@/lib/api/client';
import FeedRecoveryPanel from './feed-recovery-panel';

jest.mock('@/lib/api/client', () => ({
  cmsClient: { get: jest.fn(), post: jest.fn() },
  iamClient: { post: jest.fn() },
}));
jest.mock('@/components/operator/operator-launch-link', () => ({
  OperatorLaunchLink: () => null,
}));

const candidateID = '00000000-0000-4000-8000-000000000001';

it.each([false, true])('reviews fresh-start overrides on the same contents without bypassing file checks or live effects (inventory blocked: %s)', async (inventoryBlocked) => {
  const ids = [candidateID, '00000000-0000-4000-8000-000000000002'];
  const protections = [
    { code: 'approved_transcript', message: 'Approved human caption' },
    { code: 'protected_content', message: 'Interaction or moderation protection' },
    { code: 'content_not_terminal', message: 'Pending content' },
    { code: 'active_content_stage', message: 'Unfinished stage records' },
    { code: 'active_atomization_run', message: 'Legacy atomization records' },
    { code: 'active_circulation_recommendation', message: 'Pending circulation recommendation' },
    { code: 'artifact_ownership_unproven', message: 'Stale file registry' },
  ];
  const hardBlockers = inventoryBlocked ? [
    { code: 'storage_inventory_incomplete', message: 'File inventory is unavailable' },
    { code: 'active_stage_effect', message: 'Provider effect is unresolved' },
  ] : [];
  const options = [
    { code: 'approved_transcript', label: 'Approved captions', consequence: 'Owned captions will be cleared; shared transcripts stay intact.' },
    { code: 'protected_content', label: 'Interactions and holds', consequence: 'Interaction and moderation history is retained.' },
    { code: 'content_not_terminal', label: 'Pending or processing content', consequence: 'Content is retired after fencing.' },
    { code: 'active_content_stage', label: 'Unfinished processing records', consequence: 'Requests are cancelled; history remains.' },
    { code: 'active_atomization_run', label: 'Legacy atomization records', consequence: 'Runs are stopped; history remains.' },
    { code: 'active_circulation_recommendation', label: 'Circulation recommendations', consequence: 'Recommendations are superseded.' },
    { code: 'artifact_ownership_unproven', label: 'Stale file-registry metadata', consequence: 'Only the complete isolated inventory is deleted.' },
  ];
  const target = (id: string) => ({ content_item_id: id, snapshot: { type: 'VIDEO', status: 'READY' }, objects: [], blockers: [...protections, ...hardBlockers] });
  const oldRun = { id: 'old-preview', state: 'preview', manifest_hash: 'a'.repeat(64), created_at: '2026-10-06T00:00:00Z', created_by: 'admin', manifest: { requested_ids: ids, selection_reason: 'Old content', targets: ids.map(target) } };
  const newTargets = ids.map((id) => ({ ...target(id), blockers: hardBlockers, overridden_blockers: protections }));
  const newRun = { ...oldRun, id: 'override-preview', manifest_hash: 'b'.repeat(64), manifest: { ...oldRun.manifest, targets: newTargets, protection_override_codes: protections.map((p) => p.code), protection_override_reason: 'Obsolete content reviewed' } };
  jest.mocked(cmsClient.get).mockImplementation(async (url) => {
    if (url.startsWith('/admin/pods-reset/candidates')) return { data: { items: [], total_count: 0 } };
    if (url === '/admin/pods-reset/runs') return { data: { items: [oldRun] } };
    if (url === '/admin/feed-recovery/runs') return { data: [] };
    if (url.startsWith('/admin/pods-reset/plans/')) return { data: { run: url.endsWith('/old-preview') ? oldRun : newRun, items: [], objects: [], actions: [], can_cancel: true, protection_override_options: options } };
    throw new Error('Unexpected request: ' + url);
  });
  jest.mocked(cmsClient.post).mockResolvedValue({ data: { run: newRun, items: newTargets, counts: { selected_ids: 2, object_count: 0, object_bytes: 0 }, can_approve: !inventoryBlocked, protection_override_options: options } });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const user = userEvent.setup();
  render(<QueryClientProvider client={client}><FeedRecoveryPanel /></QueryClientProvider>);
  try {
    await user.click(screen.getByRole('tab', { name: 'Run history' }));
    await user.click(await screen.findByRole('button', { name: 'Inspect deletion plan' }));
    const preview = await screen.findByRole('button', { name: 'Preview with override choices' });
    expect(preview).toBeDisabled();
    expect(screen.queryByRole('textbox', { name: 'Deletion approval phrase' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('checkbox')).toHaveLength(options.length);
    for (const option of options) await user.click(screen.getByRole('checkbox', { name: new RegExp(option.label) }));
    expect(preview).toBeDisabled();
    await user.type(screen.getByRole('textbox', { name: 'Reason for fresh-start overrides' }), 'Obsolete content reviewed');
    expect(preview).toBeEnabled();
    await user.click(preview);
    await screen.findByText('Fresh-start overrides applied');
    expect(screen.getByText('14 blockers overridden across 2 contents.')).toBeInTheDocument();
    expect(cmsClient.post).toHaveBeenCalledWith('/admin/pods-reset/plans', {
      content_ids: ids, selection_reason: 'Old content', protection_override_codes: protections.map((protection) => protection.code), protection_override_reason: 'Obsolete content reviewed',
    });
    expect(screen.getAllByText('Blocker overridden: Approved human caption')).toHaveLength(2);
    if (inventoryBlocked) {
      expect(screen.getByRole('button', { name: 'Approval unavailable' })).toBeDisabled();
      expect(screen.getByRole('alert')).toHaveTextContent('2 of 2 contents are blocked.');
      expect(screen.getByRole('alert')).toHaveTextContent('Remaining checks prevent approval');
      expect(screen.getByRole('alert')).toHaveTextContent('Restore file verification in Aggregation');
      expect(screen.getByRole('alert')).toHaveTextContent('Discard the listed unfinished records');
      expect(screen.getByText('Your choices were saved. Approval is waiting on the remaining checks below.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Preview with override choices' })).toBeEnabled();
      expect(screen.getByRole('checkbox', { name: /Approved captions/ })).toBeChecked();
      expect(screen.getByRole('textbox', { name: 'Reason for fresh-start overrides' })).toHaveValue('Obsolete content reviewed');
      expect(screen.queryByRole('textbox', { name: 'Deletion approval phrase' })).not.toBeInTheDocument();
    } else {
      const approve = screen.getByRole('button', { name: 'Approve plan for 2 contents' });
      const phrase = screen.getByRole('textbox', { name: 'Deletion approval phrase' });
      expect(phrase).toHaveValue('');
      expect(screen.getAllByText('Eligible with override')).toHaveLength(2);
      await user.type(phrase, 'RESET PODS 2 AAAAAAAA IRREVERSIBLE');
      expect(approve).toBeDisabled();
      await user.clear(phrase);
      await user.type(phrase, 'RESET PODS 2 BBBBBBBB IRREVERSIBLE');
      expect(approve).toBeEnabled();
    }
    // Only a new preview was requested; neither approval nor execution was invoked.
    expect(cmsClient.post).toHaveBeenCalledTimes(1);
  } finally { cleanup(); client.clear(); jest.clearAllMocks(); }
});

it.each([true, false])('explains approval eligibility before requesting a phrase (blocked: %s)', async (blocked) => {
  const ids = Array.from({ length: 156 }, (_, index) => '00000000-0000-4000-8000-' + String(index + 1).padStart(12, '0'));
  const inventoryBlocker = { code: 'storage_inventory_incomplete', message: 'Aggregation could not prove a complete inventory for this item.' };
  const targets = ids.map((id) => ({
    content_item_id: id,
    snapshot: { type: 'VIDEO', status: 'READY' },
    blockers: blocked ? [inventoryBlocker] : [],
    objects: [],
  }));
  const run = {
    id: 'approval-preview', state: 'preview', manifest_hash: 'fa94a150' + 'a'.repeat(56),
    created_at: '2026-10-06T00:00:00Z', created_by: 'admin',
    manifest: { requested_ids: ids, selection_reason: 'Old videos', targets },
  };
  jest.mocked(cmsClient.get).mockImplementation(async (url) => {
    if (url.startsWith('/admin/pods-reset/candidates')) return { data: { items: [], total_count: 0 } };
    if (url === '/admin/pods-reset/runs') return { data: { items: [run] } };
    if (url === '/admin/feed-recovery/runs') return { data: [] };
    if (url === '/admin/pods-reset/plans/approval-preview') return { data: { run, items: [], objects: [], actions: [], can_cancel: true } };
    throw new Error('Unexpected request: ' + url);
  });
  jest.mocked(cmsClient.post).mockResolvedValue({ data: { id: run.id, state: 'approved', manifest_hash: run.manifest_hash } });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const user = userEvent.setup();
  render(<QueryClientProvider client={client}><FeedRecoveryPanel /></QueryClientProvider>);
  try {
    await user.click(screen.getByRole('tab', { name: 'Run history' }));
    await user.click(await screen.findByRole('button', { name: 'Inspect deletion plan' }));
    const approve = await screen.findByRole('button', { name: blocked ? 'Approval unavailable' : 'Approve plan for 156 contents' });
    expect(approve).toBeDisabled();
    if (blocked) {
      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent('Approval unavailable');
      expect(alert).toHaveTextContent('156 of 156 contents are blocked.');
      expect(alert).toHaveTextContent('A confirmation phrase cannot approve blocked contents.');
      expect(alert).toHaveTextContent('156 items: ' + inventoryBlocker.message);
      expect(screen.getByText('Listed files').parentElement).toHaveTextContent('Unavailable');
      expect(screen.getByText('Listed storage').parentElement).toHaveTextContent('Unavailable');
      expect(screen.queryByRole('textbox', { name: 'Deletion approval phrase' })).not.toBeInTheDocument();
      await user.click(approve);
      expect(cmsClient.post).not.toHaveBeenCalled();
    } else {
      expect(screen.queryByText('Approval unavailable')).not.toBeInTheDocument();
      expect(screen.getByText('Listed files').parentElement).toHaveTextContent('0');
      expect(screen.getByText('Listed storage').parentElement).toHaveTextContent('0 B');
      const input = screen.getByRole('textbox', { name: 'Deletion approval phrase' });
      await user.type(input, 'RESET PODS 155 FA94A150 IRREVERSIBLE');
      expect(approve).toBeDisabled();
      expect(screen.getByText('The confirmation phrase does not match yet.')).toBeInTheDocument();
      await user.clear(input);
      await user.type(input, ' RESET PODS 156 FA94A150 IRREVERSIBLE ');
      expect(approve).toBeEnabled();
      expect(screen.getByText('Confirmation phrase matches.')).toBeInTheDocument();
      await user.click(approve);
      await waitFor(() => expect(cmsClient.post).toHaveBeenCalledWith('/admin/pods-reset/plans/approval-preview/approve', { phrase: 'RESET PODS 156 FA94A150 IRREVERSIBLE' }));
      expect(cmsClient.post).toHaveBeenCalledTimes(1);
    }
    expect(iamClient.post).not.toHaveBeenCalled();
  } finally { cleanup(); client.clear(); jest.clearAllMocks(); }
});

it.each([
  { stages: null, label: 'no stage history', text: 'no current-generation stage evidence' },
  { stages: [{ stage: 'media', state: 'succeeded', policy_version: 'v1' }], label: 'recorded stages', text: 'media=succeeded (v1)' },
])('loads a quantity-selected candidate with $label', async ({ stages, text }) => {
  jest.mocked(cmsClient.get).mockImplementation(async (url) => {
    if (url.startsWith('/admin/pods-reset/candidates')) {
      return { data: { items: [{
        content_item_id: candidateID, title: 'A readable episode title', type: 'VIDEO', source: 'YOUTUBE', status: 'READY',
        created_at: '2026-10-06T00:00:00Z', processing_generation: 1,
        retirement_identity_available: true, stage_evidence: stages,
      }], total_count: 1234, has_more: false, next_cursor: '', page_size: 50 } };
    }
    if (url === '/admin/pods-reset/runs') return { data: { items: [] } };
    if (url === '/admin/feed-recovery/runs') return { data: [] };
    throw new Error(`Unexpected request: ${url}`);
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const user = userEvent.setup();
  render(<QueryClientProvider client={client}><FeedRecoveryPanel /></QueryClientProvider>);

  try {
    expect(await screen.findByText('1,234')).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'Number of items to delete' }), '1');
    await user.click(screen.getByText('Review 1 matching items'));
    expect(screen.getByText('A readable episode title')).toBeInTheDocument();
    await user.click(screen.getByText('Item details'));
    expect(await screen.findByText(`Stages: ${text}`)).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByText('Enter content IDs manually')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Preview 1 affected items' })).toBeDisabled();
    await user.type(screen.getByRole('textbox', { name: 'Reason for deletion' }), 'Failed import');
    expect(screen.getByRole('button', { name: 'Preview 1 affected items' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Use selected IDs below' })).not.toBeInTheDocument();
    expect(cmsClient.post).not.toHaveBeenCalled();
  } finally {
    cleanup();
    client.clear();
    jest.clearAllMocks();
  }
});

it.each(['repair', 'rotate'])('confirms the %s deletion count for the chosen run without a password', async (level) => {
  const runs = ['first', 'second'].map((id) => ({ id, plan_id: `${id}-plan`, phase: 'cancel_window', lane: 'news', created_at: '2026-10-06T00:00:00Z' }));
  jest.mocked(cmsClient.get).mockImplementation(async (url) => {
    if (url === '/admin/pods-reset/runs') return { data: { items: [] } };
    if (url === '/admin/feed-recovery/runs') return { data: runs };
    if (url.startsWith('/admin/pods-reset/candidates')) return { data: { items: [], total_count: 0 } };
    if (url.startsWith('/admin/feed-recovery/plans/')) return { id: url.split('/').at(-1), level, target_count: 0, manifest_hash: `${url.split('/').at(-1)}-manifest` };
    throw new Error(`Unexpected request: ${url}`);
  });
  jest.mocked(cmsClient.post).mockResolvedValue({ data: {} });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const user = userEvent.setup();
  render(<QueryClientProvider client={client}><FeedRecoveryPanel /></QueryClientProvider>);
  try {
    await user.click(screen.getByRole('tab', { name: 'Run history' }));
    const buttons = await screen.findAllByRole('button', { name: 'Continue' });
    expect(screen.queryByPlaceholderText(/Admin password/)).not.toBeInTheDocument();
    await user.click(buttons[0]);
    expect(await screen.findByText('Items to delete: 0. Repair and Rotate preserve canonical content.')).toBeInTheDocument();
    const count = screen.getByRole('textbox', { name: 'Type the number of items to delete' });
    const confirm = screen.getByRole('button', { name: 'Confirm execution' });
    expect(confirm).toBeDisabled();
    await user.type(count, '1');
    expect(confirm).toBeDisabled();
    await user.clear(count);
    await user.type(count, '0');
    expect(confirm).toBeEnabled();
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    expect(cmsClient.post).not.toHaveBeenCalled();
    await user.click(buttons[1]);
    await screen.findByText('Manifest second-plan-manifest');
    expect(screen.getByRole('textbox', { name: 'Type the number of items to delete' })).toHaveValue('');
    await user.type(screen.getByRole('textbox', { name: 'Type the number of items to delete' }), '0');
    await user.click(screen.getByRole('button', { name: 'Confirm execution' }));
    await waitFor(() => expect(cmsClient.post).toHaveBeenCalledWith('/admin/feed-recovery/runs/second/execute', { manifest_hash: 'second-plan-manifest', confirmed_item_count: 0 }));
    expect(cmsClient.post).toHaveBeenCalledTimes(1);
    expect(iamClient.post).not.toHaveBeenCalled();
  } finally {
    cleanup();
    client.clear();
    jest.clearAllMocks();
  }
});

it('executes an approved Pods plan after the exact item count is typed, without a password or release switch', async () => {
  const ids = Array.from({ length: 163 }, (_, index) => '00000000-0000-4000-8000-' + String(index + 1).padStart(12, '0'));
  const run = {
    id: candidateID, state: 'approved', phase: 'approval', manifest_hash: 'frozen',
    created_at: '2026-10-06T00:00:00Z', created_by: 'admin', pause_requested: false,
    manifest: { requested_ids: ids, targets: [] },
  };
  jest.mocked(cmsClient.get).mockImplementation(async (url) => {
    if (url === '/admin/pods-reset/runs') return { data: { items: [run] } };
    if (url === '/admin/pods-reset/plans/' + candidateID) return { data: { run, items: [], objects: [], actions: [] } };
    if (url === '/admin/feed-recovery/runs') return { data: [] };
    if (url.startsWith('/admin/pods-reset/candidates')) return { data: { items: [], total_count: 0 } };
    throw new Error(`Unexpected request: ${url}`);
  });
  jest.mocked(cmsClient.post).mockResolvedValue({ data: { id: candidateID, state: 'complete', phase: 'complete' } });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><FeedRecoveryPanel /></QueryClientProvider>);
  try {
    await userEvent.click(screen.getByRole('tab', { name: 'Run history' }));
    const resume = await screen.findByRole('button', { name: 'Resume same manifest' });
    expect(resume).toBeEnabled();
    await userEvent.click(resume);
    const count = await screen.findByRole('textbox', { name: 'Type the number of items to delete' });
    await waitFor(() => expect(count).toBeEnabled());
    const confirm = screen.getByRole('button', { name: 'Confirm deletion' });
    expect(confirm).toBeDisabled();
    await userEvent.type(count, '162');
    expect(confirm).toBeDisabled();
    expect(cmsClient.post).not.toHaveBeenCalled();
    await userEvent.clear(count);
    await userEvent.type(count, '163');
    expect(confirm).toBeEnabled();
    // Polling an already loaded immutable manifest must not disable deletion.
    let finishRefresh!: (value: { data: { run: typeof run; items: never[]; objects: never[]; actions: never[] } }) => void;
    jest.mocked(cmsClient.get).mockReturnValueOnce(new Promise((resolve) => { finishRefresh = resolve; }));
    let refreshing!: Promise<void>;
    act(() => { refreshing = client.refetchQueries({ queryKey: ['pods-reset', 'plan', candidateID] }); });
    await waitFor(() => expect(client.isFetching({ queryKey: ['pods-reset', 'plan', candidateID] })).toBe(1));
    expect(confirm).toBeEnabled();
    await act(async () => {
      finishRefresh({ data: { run, items: [], objects: [], actions: [] } });
      await refreshing;
    });
    jest.mocked(cmsClient.get).mockRejectedValueOnce(new Error('Temporary polling failure'));
    await act(async () => { await client.refetchQueries({ queryKey: ['pods-reset', 'plan', candidateID] }); });
    expect(confirm).toBeEnabled();
    await userEvent.click(confirm);
    await waitFor(() => expect(cmsClient.post).toHaveBeenCalledWith('/admin/pods-reset/plans/' + candidateID + '/execute', {
      manifest_hash: 'frozen', confirmed_item_count: 163,
    }));
    expect(cmsClient.post).toHaveBeenCalledTimes(1);
    expect(iamClient.post).not.toHaveBeenCalled();
  } finally {
    cleanup();
    client.clear();
    jest.clearAllMocks();
  }
});

it('continues a partial deletion from one confirmation and shows prepared versus deleted counts', async () => {
  const ids = Array.from({ length: 4 }, (_, index) => '00000000-0000-4000-8000-' + String(index + 1).padStart(12, '0'));
  let items = ids.map((id) => ({ content_item_id: id, state: 'planned', snapshot_hash: 'snapshot', decision: [], blocked_reasons: [] }));
  let run = {
    id: candidateID, state: 'partial', phase: 'fencing', manifest_hash: 'frozen',
    created_at: '2026-10-06T00:00:00Z', created_by: 'admin', pause_requested: false,
    manifest: { requested_ids: ids, targets: ids.map((id) => ({ content_item_id: id, snapshot: { type: 'VIDEO', status: 'FAILED' }, blockers: [], objects: [] })) },
  };
  jest.mocked(cmsClient.get).mockImplementation(async (url) => {
    if (url === '/admin/pods-reset/runs') return { data: { items: [run] } };
    if (url === '/admin/pods-reset/plans/' + candidateID) return { data: { run, items, objects: [], actions: [] } };
    if (url === '/admin/feed-recovery/runs') return { data: [] };
    if (url.startsWith('/admin/pods-reset/candidates')) return { data: { items: [], total_count: 0 } };
    throw new Error('Unexpected request: ' + url);
  });
  let finishDeletion!: (value: { data: { id: string; state: string; phase: string; items: typeof items } }) => void;
  jest.mocked(cmsClient.post)
    .mockImplementationOnce(async () => {
      items = items.map((item, index) => ({ ...item, state: index < 3 ? 'fenced' : 'planned' }));
      return { data: { id: candidateID, state: 'partial', phase: 'fencing', resume_allowed: true, items } };
    })
    .mockImplementationOnce(() => new Promise((resolve) => { finishDeletion = resolve; }));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const user = userEvent.setup();
  render(<QueryClientProvider client={client}><FeedRecoveryPanel /></QueryClientProvider>);
  try {
    await user.click(screen.getByRole('tab', { name: 'Run history' }));
    await user.click(await screen.findByRole('button', { name: 'Resume same manifest' }));
    await user.type(await screen.findByRole('textbox', { name: 'Type the number of items to delete' }), '4');
    await user.click(screen.getByRole('button', { name: 'Confirm deletion' }));
    await waitFor(() => expect(cmsClient.post).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('Preparing contents before file deletion')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Contents prepared').parentElement).toHaveTextContent('3 / 4'));
    expect(screen.getByText('Contents deleted').parentElement).toHaveTextContent('0 / 4');
    expect(screen.getByText(/Keep this page open\. Deletion continues automatically/)).toBeInTheDocument();
    await act(async () => {
      run = { ...run, state: 'complete', phase: 'purge_only_complete' };
      items = items.map((item) => ({ ...item, state: 'complete' }));
      finishDeletion({ data: { id: candidateID, state: 'complete', phase: run.phase, items } });
    });
    expect(await screen.findByText('Deletion complete')).toBeInTheDocument();
    expect(screen.getByText('Contents deleted').parentElement).toHaveTextContent('4 / 4');
    for (const call of jest.mocked(cmsClient.post).mock.calls) expect(call).toEqual([
      '/admin/pods-reset/plans/' + candidateID + '/execute', { manifest_hash: 'frozen', confirmed_item_count: 4 },
    ]);
    expect(iamClient.post).not.toHaveBeenCalled();
  } finally { cleanup(); client.clear(); jest.clearAllMocks(); }
});

it('previews the entered quantity of exact matching items and invalidates changed quantities or filters', async () => {
  const idFor = (index: number) => '00000000-0000-4000-8000-' + String(index).padStart(12, '0');
  const candidateFor = (index: number) => ({ content_item_id: idFor(index), title: 'Episode ' + index, type: 'VIDEO', source: 'YOUTUBE', status: 'READY', created_at: '2026-10-06T00:00:00Z', stage_evidence: [] });
  const selectedIDs = Array.from({ length: 40 }, (_, index) => idFor(index + 1));
  const targets = selectedIDs.map((id) => ({ content_item_id: id, snapshot: { type: 'VIDEO', status: 'READY' }, blockers: [], objects: [] }));
  let run = { id: 'preview-run', state: 'preview', manifest_hash: 'a'.repeat(64), schema_fingerprint: 'schema', policy_version: 1, expires_at: '2026-10-07T00:00:00Z', manifest: { requested_ids: selectedIDs, selection_reason: 'Failed import', targets } };
  jest.mocked(cmsClient.get).mockImplementation(async (url) => {
    if (url.startsWith('/admin/pods-reset/candidates')) {
      const podcasts = url.includes('type=PODCAST');
      return { data: { items: podcasts ? [candidateFor(101), candidateFor(102)] : Array.from({ length: 50 }, (_, index) => candidateFor(index + 1)), total_count: podcasts ? 2 : 435, has_more: !podcasts, next_cursor: idFor(30), page_size: 30 } };
    }
    if (url === '/admin/pods-reset/plans/preview-run') return { data: { run, items: run.manifest.targets, objects: [], actions: [], can_cancel: true } };
    if (url === '/admin/pods-reset/runs') return { data: { items: [] } };
    if (url === '/admin/feed-recovery/runs') return { data: [] };
    throw new Error('Unexpected request: ' + url);
  });
  jest.mocked(cmsClient.post).mockImplementation(async (_url, body) => {
    const ids = (body as { content_ids: string[] }).content_ids;
    const items = targets.filter((target) => ids.includes(target.content_item_id));
    run = { ...run, manifest: { ...run.manifest, requested_ids: ids, targets: items } };
    return { data: { run, items, counts: { selected_ids: ids.length, object_count: 8, object_bytes: 2048 }, can_approve: true } };
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const user = userEvent.setup();
  render(<QueryClientProvider client={client}><FeedRecoveryPanel /></QueryClientProvider>);
  try {
    await screen.findByText('435');
    const quantity = screen.getByRole('textbox', { name: 'Number of items to delete' });
    await user.type(quantity, '435');
    await user.type(screen.getByRole('textbox', { name: 'Reason for deletion' }), 'Failed import');
    expect(screen.getByRole('button', { name: 'Preview 435 affected items' })).toBeEnabled();
    expect(screen.getByText(/Showing the first 50 of 435 affected items/)).toBeInTheDocument();
    await user.clear(quantity);
    await user.type(quantity, '436');
    expect(screen.getByText(/Only 435 matching items are available/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Preview 0 affected items' })).toBeDisabled();
    await user.clear(quantity);
    await user.type(quantity, '40');
    expect(screen.getByText('Review 40 matching items')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByText('Enter content IDs manually')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Preview 40 affected items' }));
    await screen.findByRole('heading', { name: /2\. Review deletion/ });
    expect(cmsClient.post).toHaveBeenCalledWith('/admin/pods-reset/plans', { content_ids: selectedIDs, selection_reason: 'Failed import' });
    expect(cmsClient.post).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Contents in this plan')).toBeInTheDocument();
    expect(screen.getByText('2.0 KB')).toBeInTheDocument();
    await user.clear(quantity);
    await user.type(quantity, '29');
    expect(screen.queryByRole('heading', { name: /2\. Review deletion/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Preview 29 affected items' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Preview 29 affected items' }));
    await screen.findByRole('heading', { name: /2\. Review deletion/ });
    expect(cmsClient.post).toHaveBeenLastCalledWith('/admin/pods-reset/plans', { content_ids: selectedIDs.slice(0, 29), selection_reason: 'Failed import' });
    await user.selectOptions(screen.getByRole('combobox', { name: 'Content type' }), 'PODCAST');
    await user.click(screen.getByRole('button', { name: 'Apply filters / Refresh' }));
    await screen.findByText(/Only 2 matching items are available/);
    expect(quantity).toHaveValue('29');
    expect(screen.getByRole('button', { name: 'Preview 0 affected items' })).toBeDisabled();
    expect(screen.queryByRole('heading', { name: /2\. Review deletion/ })).not.toBeInTheDocument();
    await user.clear(quantity);
    await user.type(quantity, '2');
    expect(screen.getByRole('button', { name: 'Preview 2 affected items' })).toBeEnabled();
    await user.click(screen.getByText('Review 2 matching items'));
    expect(screen.getByText('Episode 101')).toBeInTheDocument();
    expect(screen.getByText('Episode 102')).toBeInTheDocument();
    expect(screen.queryByText('Episode 1')).not.toBeInTheDocument();
    expect(cmsClient.post).toHaveBeenCalledTimes(2);
  } finally { cleanup(); client.clear(); jest.clearAllMocks(); }
});

it('rejects blank, zero, fractional, negative and unrepresentable quantities without sending a preview', async () => {
  jest.mocked(cmsClient.get).mockImplementation(async (url) => {
    if (url.startsWith('/admin/pods-reset/candidates')) return { data: { items: Array.from({length: 30}, (_, index) => ({ content_item_id: '00000000-0000-4000-8000-' + String(index + 1).padStart(12, '0'), title: 'Episode ' + index, type: 'VIDEO', source: 'YOUTUBE', status: 'READY', created_at: '2026-10-06T00:00:00Z', stage_evidence: [] })), total_count: 435 } };
    if (url === '/admin/pods-reset/runs') return { data: { items: [] } };
    if (url === '/admin/feed-recovery/runs') return { data: [] };
    throw new Error('Unexpected request: ' + url);
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const user = userEvent.setup();
  render(<QueryClientProvider client={client}><FeedRecoveryPanel /></QueryClientProvider>);
  try {
    await screen.findByText('435');
    const quantity = screen.getByRole('textbox', { name: 'Number of items to delete' });
    await user.type(screen.getByRole('textbox', { name: 'Reason for deletion' }), 'Failed import');
    expect(screen.getByRole('button', { name: 'Preview 0 affected items' })).toBeDisabled();
    for (const value of ['0', '-1', '1.5', '1e1', '9999999999999999999']) {
      await user.clear(quantity);
      await user.type(quantity, value);
      expect(screen.getByText('Enter a positive whole number.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Preview 0 affected items' })).toBeDisabled();
    }
    expect(cmsClient.post).not.toHaveBeenCalled();
  } finally { cleanup(); client.clear(); jest.clearAllMocks(); }
});

it.each([undefined, 0])('distinguishes an unavailable total from a genuine empty inventory (%s)', async (totalCount) => {
  jest.mocked(cmsClient.get).mockImplementation(async (url) => {
    if (url.startsWith('/admin/pods-reset/candidates')) return { data: { items: [], total_count: totalCount, has_more: false } };
    if (url === '/admin/pods-reset/runs') return { data: { items: [] } };
    if (url === '/admin/feed-recovery/runs') return { data: [] };
    throw new Error('Unexpected request: ' + url);
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><FeedRecoveryPanel /></QueryClientProvider>);
  try {
    await screen.findByText('No contents match these filters.');
    const counts = within(screen.getByLabelText('Content counts'));
    const matching = counts.getByText('Matching contents').parentElement;
    expect(matching).toHaveTextContent(totalCount === undefined ? '—' : '0');
    if (totalCount === undefined) expect(screen.getByText(/Total count is unavailable/)).toBeInTheDocument();
    else expect(screen.queryByText(/Total count is unavailable/)).not.toBeInTheDocument();
    expect(cmsClient.post).not.toHaveBeenCalled();
  } finally { cleanup(); client.clear(); jest.clearAllMocks(); }
});
