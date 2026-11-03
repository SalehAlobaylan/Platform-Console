import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MediaAcquisitionSettingsCard } from './media-acquisition-settings-card';
import {
  getMediaAcquisitionConfig,
  updateMediaAcquisitionConfig,
} from '@/lib/api/cms/media-acquisition';
import { mediaAcquisitionKeys } from '@/hooks/use-media-acquisition';

jest.mock('@/lib/api/cms/media-acquisition', () => ({
  getMediaAcquisitionConfig: jest.fn(),
  updateMediaAcquisitionConfig: jest.fn(),
}));
jest.mock('@/components/ui/toast', () => ({ toast: jest.fn() }));
const saved = {
  tenant_id: 'default',
  default_mode: 'manual',
  pods_source_run_item_limit: 10,
  can_manage: true,
  updated_at: '2026-11-03T12:00:00Z',
  updated_by: 'admin',
  created_at: '2026-11-03T12:00:00Z',
};
function mount() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    client,
    ...render(
      <QueryClientProvider client={client}>
        <MediaAcquisitionSettingsCard />
      </QueryClientProvider>
    ),
  };
}
beforeEach(() => {
  jest.resetAllMocks();
  (getMediaAcquisitionConfig as jest.Mock).mockResolvedValue(saved);
  (updateMediaAcquisitionConfig as jest.Mock).mockResolvedValue({
    ...saved,
    default_mode: 'automatic',
    updated_at: '2026-11-03T12:01:00Z',
  });
});
it('edits without applying, discards, and reviews automatic processing before saving', async () => {
  mount();
  const automatic = await screen.findByRole('radio', { name: /Automatic/ });
  expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
  fireEvent.click(automatic);
  expect(updateMediaAcquisitionConfig).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }));
  expect(screen.getByRole('radio', { name: /By request/ })).toBeChecked();
  fireEvent.click(automatic);
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  const review = await screen.findByRole('dialog');
  expect(review).toHaveTextContent(
    'Chapters may publish under the existing publishing policy.'
  );
  expect(review).toHaveTextContent('Saving preserves the pipeline pause.');
  expect(updateMediaAcquisitionConfig).not.toHaveBeenCalled();
  fireEvent.click(within(review).getByRole('button', { name: 'Save changes' }));
  await waitFor(() =>
    expect(updateMediaAcquisitionConfig).toHaveBeenCalledWith({
      default_mode: 'automatic',
      expected_updated_at: saved.updated_at,
    })
  );
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  );
  expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
});
it('preserves the draft when the owner changes and reviews the newest revision', async () => {
  const { client } = mount();
  fireEvent.change(await screen.findByRole('spinbutton'), {
    target: { value: '12' },
  });
  const latest = {
    ...saved,
    pods_source_run_item_limit: 15,
    updated_at: '2026-11-03T12:02:00Z',
  };
  client.setQueryData(mediaAcquisitionKeys.config, latest);
  expect(
    await screen.findByText(/Saved settings changed while you were editing/)
  ).toBeInTheDocument();
  expect(screen.getByRole('spinbutton')).toHaveValue(12);
  (getMediaAcquisitionConfig as jest.Mock).mockResolvedValue(latest);
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  const review = await screen.findByRole('dialog');
  expect(review).toHaveTextContent('15 → 12');
  fireEvent.click(within(review).getByRole('button', { name: 'Cancel' }));
  expect(screen.getByRole('spinbutton')).toHaveValue(12);
  expect(updateMediaAcquisitionConfig).not.toHaveBeenCalled();
});
it('keeps a failed save visible and preserves editable values', async () => {
  (updateMediaAcquisitionConfig as jest.Mock).mockRejectedValue({
    status: 409,
    message: 'Settings changed',
  });
  mount();
  fireEvent.change(await screen.findByRole('spinbutton'), {
    target: { value: '12' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Settings changed'
  );
  expect(screen.getByRole('spinbutton')).toHaveValue(12);
});
it('does not offer edits to a read-only operator', async () => {
  (getMediaAcquisitionConfig as jest.Mock).mockResolvedValue({
    ...saved,
    can_manage: false,
  });
  mount();
  expect(
    await screen.findByRole('radio', { name: /Automatic/ })
  ).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
  expect(screen.getByText(/View only/)).toBeInTheDocument();
});
