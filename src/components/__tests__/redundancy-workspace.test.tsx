import React from 'react';
import userEvent from '@testing-library/user-event';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import RedundancyWorkspace from '@/components/platform/media/redundancy/workspace';
import * as api from '@/lib/api/cms/redundancy';

jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock('@/lib/api/cms/redundancy');
const mocked = jest.mocked(api);
const pairID = '11111111-1111-4111-8111-111111111111';
const a = '22222222-2222-4222-8222-222222222222';
const b = '33333333-3333-4333-8333-333333333333';
const status = {
  policy: {
    enabled: true,
    collapse_enabled: true,
    emit_circulation_recs: false,
    sweep_interval_minutes: 360,
    max_frontier_items: 500,
    max_pairs_scored: 2000,
    proposal_floor: 0.75,
    lane_settings: {},
    scan_state: {},
    paused_until: null,
    last_swept_at: null,
    updated_at: '',
  },
  latest_run: null,
  library_items: 20,
  open_proposals: 1,
  active_families: 0,
  redundant_members: 0,
  redundant_bytes: 0,
  redundancy_rate: 0,
  fingerprint_items: 10,
  oldest_proposal_at: null,
  reclaim_awaiting_approval: 0,
  evaluator_version: 'v2',
  generated_at: '',
  lane_settings: {
    transcript_confirm: 0.8,
    embedding_confirm: 0.93,
    title_confirm: 0.7,
    title_weight: 0.1,
    transcript_weight: 0.7,
    embedding_weight: 0.18,
    thumbnail_weight: 0.02,
  },
};
function mount() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <RedundancyWorkspace />
    </QueryClientProvider>
  );
}
beforeEach(() => {
  jest.resetAllMocks();
  mocked.getRedundancyStatus.mockResolvedValue(status);
  mocked.listRedundancyPairs.mockResolvedValue({
    data: [
      {
        id: pairID,
        item_a_id: a,
        item_b_id: b,
        confidence: 0.91,
        verdict: 'high_confidence_duplicate',
        tombstoned: false,
        latest_evaluation_id: 42,
        created_at: '',
      },
    ],
    total: 1,
    offset: 0,
    limit: 25,
  });
  mocked.getRedundancyPair.mockResolvedValue({
    pair: {
      id: pairID,
      item_a_id: a,
      item_b_id: b,
      confidence: 0.91,
      verdict: 'high_confidence_duplicate',
      tombstoned: false,
      latest_evaluation_id: 42,
      created_at: '',
    },
    items: [
      {
        id: a,
        title: 'Episode from channel A',
        source_name: 'Channel A',
        type: 'VIDEO',
        file_size_bytes: 100,
        view_count: 12,
        like_count: 1,
        share_count: 0,
      },
      {
        id: b,
        title: 'Episode from channel B',
        type: 'VIDEO',
        file_size_bytes: 100,
        view_count: 0,
        like_count: 0,
        share_count: 0,
      },
    ],
    evaluations: [
      {
        id: 42,
        pair_id: 1,
        confidence: 0.91,
        machine_verdict: 'high_confidence_duplicate',
        evaluator_version: 'v2',
        input_fingerprint: 'hash',
        created_at: '',
        lane_scores: { transcript: { score: 0.91, available: true } },
      },
    ],
    transcript_snippets: {
      [a]: 'matching transcript excerpt',
      [b]: 'matching transcript excerpt',
    },
    matching_shingle: 'matching transcript excerpt',
  });
  mocked.confirmRedundancyPair.mockResolvedValue({ success: true });
});
it('requires opening current evidence and sends its exact evaluation when confirming', async () => {
  mount();
  await screen.findByText('Strong evidence');
  expect(
    screen.queryByRole('button', { name: 'Confirm same recording' })
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Compare/ }));
  await screen.findByText('Episode from channel A');
  expect(screen.getByText('Episode from channel B')).toBeInTheDocument();
  fireEvent.click(
    screen.getByRole('button', { name: 'Confirm same recording' })
  );
  await waitFor(() =>
    expect(mocked.confirmRedundancyPair).toHaveBeenCalledWith(
      { id: pairID, evaluationId: 42 },
      expect.anything()
    )
  );
});
it('keeps rejection disabled until an authored reason exists', async () => {
  mount();
  fireEvent.click(await screen.findByRole('button', { name: /Compare/ }));
  const reject = await screen.findByRole('button', {
    name: 'Different recordings',
  });
  expect(reject).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Reason for rejection'), {
    target: { value: 'Different adjacent episodes' },
  });
  expect(reject).toBeEnabled();
});
it('shows unavailable evidence rather than zero-valued healthy metrics', async () => {
  mocked.getRedundancyStatus.mockRejectedValue(
    new Error('CMS evidence unavailable')
  );
  mount();
  await screen.findByRole('alert');
  expect(screen.getByText('CMS evidence unavailable')).toBeInTheDocument();
  expect(screen.queryByText('Media records')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Scan changes' })).toBeDisabled();
});
it('shows a resumable pause and offers resume', async () => {
  mocked.getRedundancyStatus.mockResolvedValue({
    ...status,
    policy: { ...status.policy, paused_until: '2099-01-01T00:00:00Z' },
  });
  mount();
  expect(
    await screen.findByRole('button', { name: 'Resume' })
  ).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Scan changes' })).toBeDisabled();
});

async function openTab(name: string) {
  await userEvent.setup().click(await screen.findByRole('tab', { name }));
}
it('saves only edited policy fields and binds the observed revision', async () => {
  mocked.getRedundancyStatus.mockResolvedValue({
    ...status,
    policy: { ...status.policy, updated_at: '2026-10-19T10:00:00Z' },
  });
  mocked.updateRedundancyPolicy.mockResolvedValue(status.policy);
  mount();
  await openTab('Settings');
  fireEvent.change(screen.getByLabelText('Proposal confidence floor'), {
    target: { value: '0.8' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save policy' }));
  await waitFor(() =>
    expect(mocked.updateRedundancyPolicy).toHaveBeenCalledWith(
      { proposal_floor: 0.8, expected_updated_at: '2026-10-19T10:00:00Z' },
      expect.anything()
    )
  );
});
it('preserves the draft and exposes a concurrent policy conflict', async () => {
  mocked.updateRedundancyPolicy.mockRejectedValue(
    new Error('Policy changed; reload current settings')
  );
  mount();
  await openTab('Settings');
  fireEvent.change(screen.getByLabelText('Proposal confidence floor'), {
    target: { value: '0.8' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save policy' }));
  await screen.findByText('Policy changed; reload current settings');
  expect(screen.getByLabelText('Proposal confidence floor')).toHaveValue(0.8);
});
it('auditions an HLS fallback and advances when a preview fails', async () => {
  const detail = await mocked.getRedundancyPair(pairID);
  mocked.getRedundancyPair.mockResolvedValue({
    ...detail,
    items: [
      {
        ...detail.items[0],
        playback_type: 'hls',
        playback_url: 'https://fixture.test/master.m3u8',
        fallback_playback_url: 'https://fixture.test/fallback.mp4',
        media_url: 'https://fixture.test/direct.mp3',
      },
    ],
  });
  mount();
  fireEvent.click(await screen.findByRole('button', { name: /Compare/ }));
  const audio = await screen.findByLabelText('Recording preview');
  expect(audio).toHaveAttribute('src', 'https://fixture.test/fallback.mp4');
  fireEvent.error(audio);
  expect(audio).toHaveAttribute('src', 'https://fixture.test/direct.mp3');
});
it('paginates run evaluations independently of run history', async () => {
  const run = {
    id: pairID,
    trigger: 'manual',
    status: 'completed',
    summary: '26 evaluated pairs',
    started_at: '',
    finished_at: null,
    counts: {},
    error: '',
  };
  const evaluation = (id: number) => ({
    id,
    pair_id: id,
    confidence: 0.9,
    machine_verdict: 'high_confidence_duplicate',
    evaluator_version: 'v3',
    input_fingerprint: 'hash',
    created_at: '',
    lane_scores: {},
  });
  mocked.listRedundancyRuns.mockResolvedValue({ data: [run] });
  mocked.listRedundancyActions.mockResolvedValue({
    data: [],
    total: 0,
    offset: 0,
    limit: 25,
  });
  mocked.getRedundancyRun.mockImplementation(async (_id, offset = 0) => ({
    run,
    evaluations: offset
      ? [evaluation(26)]
      : Array.from({ length: 25 }, (_, i) => evaluation(i + 1)),
    total: 26,
    offset,
    limit: 25,
  }));
  mount();
  await openTab('Activity');
  fireEvent.click(
    await screen.findByRole('button', { name: /26 evaluated pairs/ })
  );
  await screen.findByText('1–25 / 26');
  const next = screen
    .getAllByRole('button', { name: 'Next' })
    .find((b) => !b.hasAttribute('disabled'))!;
  fireEvent.click(next);
  await waitFor(() =>
    expect(mocked.getRedundancyRun).toHaveBeenLastCalledWith(pairID, 25)
  );
  await screen.findByText('26–26 / 26');
});

it('refreshes an open review queue when another run produces proposals', async () => {
  jest.useFakeTimers();
  try {
    const populated = await mocked.listRedundancyPairs();
    mocked.listRedundancyPairs
      .mockResolvedValueOnce({ data: [], total: 0, offset: 0, limit: 25 })
      .mockResolvedValue(populated);
    mount();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1);
    });
    expect(screen.queryByText('Strong evidence')).not.toBeInTheDocument();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(30000);
    });
    expect(mocked.listRedundancyPairs).toHaveBeenCalledTimes(3);
    expect(screen.getByText('Strong evidence')).toBeInTheDocument();
  } finally {
    jest.useRealTimers();
  }
});
