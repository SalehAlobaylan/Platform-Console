import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SupplyActionLifecycle } from '@/components/platform/media/circulation/supply-continuity-panel';
import type { MediaSupplyActionPreview, MediaSupplyActionRequest, MediaSupplyEpisode } from '@/types/platform/media-circulation';

const previewID = '11111111-1111-4111-8111-111111111111';
const targetID = '22222222-2222-4222-8222-222222222222';
const actionID = '33333333-3333-4333-8333-333333333333';
const episodeID = '44444444-4444-4444-8444-444444444444';
let mockHistory: MediaSupplyActionRequest[] = [];
let mockPreview: MediaSupplyActionPreview;
let mockAction: MediaSupplyActionRequest;
const mockConfirm = jest.fn();
const mockCancel = jest.fn();
const mockPreviewMutation = jest.fn();

jest.mock('@/hooks/use-media-circulation', () => ({
  ...jest.requireActual('@/hooks/use-media-circulation'),
  useMediaSupplyEligibleActions: () => ({ isLoading: false, data: { items: [{ id: 'e'.repeat(64), key: 'artifact.request_transcript', execution_owner: 'media', manual_only: false, disabled: false }] } }),
  useCreateMediaSupplyActionPreview: () => ({ mutate: mockPreviewMutation }),
  useConfirmMediaSupplyActionPreview: () => ({ mutate: mockConfirm }),
  useCancelMediaSupplyAction: () => ({ mutate: mockCancel }),
  useMediaSupplyAction: (id: string | null) => ({ data: id ? mockAction : undefined }),
  useMediaSupplyActionEvents: () => ({ data: { events: [] } }),
  useMediaSupplyActionHistory: () => ({ data: { items: mockHistory, next_cursor: '' } }),
}));

const episode = { id: episodeID, state: 'open' } as MediaSupplyEpisode;

beforeEach(() => {
  mockHistory = [];
  mockPreview = { id: previewID, action_key: 'artifact.request_transcript', target_type: 'content_item', target_id: targetID, evidence_digest: 'a'.repeat(64), policy_digest: 'b'.repeat(64), state: 'active', expires_at: '2099-01-01T00:00:00Z', planned_effects: { verification: 'Persisted transcript with exact provenance' }, affected_subjects: [], deep_links: ['/platform/media/circulation'] };
  mockAction = { id: actionID, action_key: mockPreview.action_key, target_type: mockPreview.target_type, target_id: targetID, execution_owner: 'media', state: 'queued', planned_effects: {}, affected_subjects: [], affected_domains: ['media'], deep_links: [], created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' };
  mockConfirm.mockReset().mockImplementation((_id, callbacks) => callbacks.onSuccess(mockAction));
  mockCancel.mockReset();
  mockPreviewMutation.mockReset().mockImplementation((_selection, callbacks) => callbacks.onSuccess(mockPreview));
});

it.each([['en', 'Preview Recover missing transcript', 'Confirm and queue', 'Exact target'], ['ar', 'معاينة استرداد النص المفرغ المفقود', 'تأكيد ووضع في الطابور', 'الهدف المحدد']] as const)('shows reviewable exact preview before approval in %s', (locale, previewLabel, confirmLabel, targetLabel) => {
  render(<SupplyActionLifecycle episode={episode} locale={locale} />);
  expect(screen.queryByRole('button', { name: confirmLabel })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: previewLabel }));
  expect(screen.getByText(targetLabel)).toBeInTheDocument();
  expect(screen.getByText(`content_item: ${targetID}`)).toBeInTheDocument();
  expect(screen.getByText('media')).toBeInTheDocument();
  expect(screen.getByText('a'.repeat(64))).toBeInTheDocument();
  expect(screen.getByText('b'.repeat(64))).toBeInTheDocument();
  expect(screen.getByText('Persisted transcript with exact provenance')).toBeInTheDocument();
  expect(screen.getByRole('link')).toHaveAttribute('href', '/platform/media/circulation');
  expect(mockConfirm).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: confirmLabel }));
  expect(mockConfirm).toHaveBeenCalledWith(previewID, expect.any(Object));
  expect(screen.queryByText('Succeeded and verified')).not.toBeInTheDocument();
});

it('prevents confirming an expired preview', () => {
  mockPreview.expires_at = '2000-01-01T00:00:00Z';
  render(<SupplyActionLifecycle episode={episode} locale="en" />);
  fireEvent.click(screen.getByRole('button', { name: 'Preview Recover missing transcript' }));
  expect(screen.getByRole('button', { name: 'Confirm and queue' })).toBeDisabled();
  expect(screen.getByRole('status')).toHaveTextContent('Preview expired');
  expect(mockConfirm).not.toHaveBeenCalled();
});

it.each(['en', 'ar'] as const)('reloads and cancels the durable action without creating another repair in %s', async (locale) => {
  mockHistory = [mockAction];
  const { unmount } = render(<SupplyActionLifecycle episode={episode} locale={locale} />);
  await waitFor(() => expect(screen.getByRole('button', { name: locale === 'ar' ? 'إلغاء بأمان' : 'Cancel safely' })).toBeEnabled());
  unmount();
  render(<SupplyActionLifecycle episode={episode} locale={locale} />);
  fireEvent.click(await screen.findByRole('button', { name: locale === 'ar' ? 'إلغاء بأمان' : 'Cancel safely' }));
  expect(mockCancel).toHaveBeenCalledWith(actionID);
  expect(mockPreviewMutation).not.toHaveBeenCalled();
  expect(mockConfirm).not.toHaveBeenCalled();
});

 it('allows a new eligible preview after a terminal action without requeueing history', async () => {
  mockAction.state = 'failed'; mockHistory = [mockAction];
  render(<SupplyActionLifecycle episode={episode} locale="en" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Preview new recovery' }));
  fireEvent.click(screen.getByRole('button', { name: 'Preview Recover missing transcript' }));
  expect(mockPreviewMutation).toHaveBeenCalledTimes(1);
  expect(mockConfirm).not.toHaveBeenCalled();
 });
