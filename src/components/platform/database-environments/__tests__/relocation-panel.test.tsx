import { act, fireEvent, render, screen } from '@testing-library/react';
import RelocationPanel from '../relocation-panel';
import { databaseMigrationAPI } from '@/lib/api/database-migrations';

jest.mock('@/lib/api/database-migrations', () => ({
  databaseMigrationAPI: {
    status: jest.fn(),
    actions: jest.fn(),
    programs: jest.fn(),
  },
}));
const api = databaseMigrationAPI as jest.Mocked<typeof databaseMigrationAPI>;
const status = {
  status: 'ready' as const,
  control_store_ready: true,
  execution_enabled: false,
  observed_at: '2026-10-04T10:58:50Z',
};
const actions = {
  execution_enabled: false,
  items: [
    {
      key: 'db_migration.restore_archive',
      version: 'v1',
      class: 'approval_required' as const,
      enabled: false,
      execution_owner: 'postgres_adapter',
      verification_owner: 'independent_postgres_verifier',
      rollback_class: 'forward_cleanup',
    },
  ],
};
beforeEach(() => {
  jest.resetAllMocks();
  api.status.mockResolvedValue(status);
  api.actions.mockResolvedValue(actions);
  api.programs.mockResolvedValue({ items: [] });
});

it('treats missing optional setup as guidance and skips an unavailable history read', async () => {
  const onDatabaseHealth = jest.fn();
  api.status.mockResolvedValue({
    ...status,
    status: 'not_configured',
    control_store_ready: false,
  });
  render(<RelocationPanel onDatabaseHealth={onDatabaseHealth} />);
  expect(
    await screen.findByText(/This optional feature is not needed/)
  ).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(
    screen.queryByText('No relocations have been recorded.')
  ).not.toBeInTheDocument();
  expect(
    screen.getByText('Copying and cutover').parentElement?.parentElement
  ).toHaveTextContent('Disabled');
  expect(api.programs).not.toHaveBeenCalled();
  const details = screen.getByText('Technical details').closest('details');
  expect(details).not.toHaveAttribute('open');
  expect(details).toHaveTextContent('Separate approval required');
  fireEvent.click(screen.getByRole('button', { name: 'Open Database health' }));
  expect(onDatabaseHealth).toHaveBeenCalledTimes(1);
});

it('keeps failed status unknown and recovers through a read-only retry', async () => {
  api.status.mockRejectedValueOnce(
    new Error('Relocation coordinator unavailable')
  );
  render(<RelocationPanel />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Try Check again');
  expect(
    screen.queryByText('Disabled', { exact: true })
  ).not.toBeInTheDocument();
  expect(
    screen.queryByText('No relocations have been recorded.')
  ).not.toBeInTheDocument();
  expect(api.programs).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Check again' }));
  expect(
    await screen.findByText('No relocations have been recorded.')
  ).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(api.status).toHaveBeenCalledTimes(2);
  expect(api.programs).toHaveBeenCalledTimes(1);
});

it('does not replace unreadable records with empty history even when the connection succeeds', async () => {
  api.programs.mockRejectedValue(
    new Error('Relocation coordinator returned invalid programs data.')
  );
  render(<RelocationPanel />);
  expect(await screen.findByRole('alert')).toBeInTheDocument();
  expect(screen.getByText('Connected')).toBeInTheDocument();
  expect(
    screen.getByText(/an unavailable check does not mean the history is empty/)
  ).toBeInTheDocument();
  expect(
    screen.queryByText('No relocations have been recorded.')
  ).not.toBeInTheDocument();
});

it('keeps a registry failure visible rather than displaying zero capabilities', async () => {
  api.actions.mockRejectedValue(new Error('Invalid actions response'));
  render(<RelocationPanel />);
  expect(await screen.findByRole('alert')).toBeInTheDocument();
  expect(
    screen.getByText('The capability registry could not be read.')
  ).toBeInTheDocument();
});

it('shows saved relocation records without offering execution', async () => {
  api.programs.mockResolvedValue({
    items: [
      {
        id: '11111111-1111-4111-8111-111111111111',
        environment: 'disposable',
        source_alias: 'source',
        target_alias: 'target',
        control_alias: 'control',
        state: 'analyzed',
        created_at: status.observed_at,
        updated_at: status.observed_at,
        policy_version: 'db-migration/v1',
        units: [],
      },
    ],
  });
  render(<RelocationPanel />);
  expect(await screen.findByText('source → target')).toBeInTheDocument();
  expect(
    screen.getByText('Read-only relocation monitoring')
  ).toBeInTheDocument();
  expect(
    screen.getByText(/This tab shows relocation status and saved analyses/)
  ).toBeInTheDocument();
  expect(screen.getByText(/Recorded state/)).toHaveTextContent('analyzed');
  expect(
    screen.getByText(/Database copying and cutover are disabled/)
  ).toBeInTheDocument();
  expect(
    screen.getAllByRole('button').map((button) => button.textContent)
  ).toEqual(['Check again']);
});

it('uses the parent Arabic language without repeating checks', async () => {
  api.status.mockResolvedValue({
    ...status,
    status: 'not_configured',
    control_store_ready: false,
  });
  const { rerender } = render(<RelocationPanel />);
  await screen.findByText(/This optional feature is not needed/);
  rerender(<RelocationPanel language="ar" onDatabaseHealth={jest.fn()} />);
  expect(screen.getByTestId('database-relocation-panel')).toHaveAttribute(
    'dir',
    'rtl'
  );
  expect(screen.getByText(/هذه ميزة اختيارية لا تحتاجها/)).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'افتح صحة قاعدة البيانات' })
  ).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'افحص مجدداً' })
  ).toBeInTheDocument();
  expect(api.status).toHaveBeenCalledTimes(1);
});

it('ignores a check that finishes after the tab is unmounted', async () => {
  let resolve!: (value: typeof status) => void;
  api.status.mockReturnValue(
    new Promise((done) => {
      resolve = done;
    })
  );
  const { unmount } = render(<RelocationPanel />);
  expect(screen.getByRole('button', { name: 'Check again' })).toBeDisabled();
  unmount();
  await act(async () => {
    resolve(status);
  });
  expect(api.programs).not.toHaveBeenCalled();
});
