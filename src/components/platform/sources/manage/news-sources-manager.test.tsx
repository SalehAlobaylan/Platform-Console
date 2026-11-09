import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NewsSourcesManager } from './news-sources-manager';
import { getNewsCollection, previewNewsCollection, applyNewsCollection } from '@/lib/api/cms/news-collection';

jest.mock('@/lib/api/cms/news-collection', () => ({ getNewsCollection: jest.fn(), previewNewsCollection: jest.fn(), applyNewsCollection: jest.fn() }));
jest.mock('@/hooks/use-sources', () => ({ sourceKeys: { all: ['sources'] } }));
jest.mock('@/hooks/use-discovery', () => ({ discoveryKeys: { all: ['discovery'] }, useNewsSources: () => ({ data: mockNewsData, isLoading: false, isError: false, refetch: mockRefetch }), useProfiles: () => ({ data: { data: [] } }) }));
jest.mock('@/components/platform/sources/shared/source-action-menu', () => ({ SourceActionMenu: () => <button aria-label="Source actions">Actions</button> }));
jest.mock('@/components/platform/sources/shared/source-management-dialogs', () => ({ SourceManagementDialogs: () => null }));
jest.mock('@/components/platform/news/news-section-nav', () => ({ NewsSectionNav: () => null }));
jest.mock('@/components/ui/toast', () => ({ toast: jest.fn() }));

const mockRefetch = jest.fn();
const rows = [
    { id: 'a', name: 'Daily News', type: 'RSS', feed_url: 'https://daily.example/feed', is_active: false, items_count: 0 },
    { id: 'b', name: 'Metro', type: 'RSS', feed_url: 'https://metro.example/feed', is_active: false, items_count: 0 },
    { id: 'c', name: 'Telegram Source', type: 'TELEGRAM', feed_url: 'https://t.me/news', is_active: false, items_count: 0 },
];
let mockNewsData = { data: rows };
const readiness = { ready: true, paused: false, blockers: [], control_version: 0 };

beforeEach(() => {
    jest.clearAllMocks();mockNewsData = { data: rows.map(row => ({ ...row })) };
    (getNewsCollection as jest.Mock).mockResolvedValue({ total: 3, enabled: 0, can_manage: true, environment: 'local', readiness, operations: [], needs_configuration: 1, configuration_issues: [{ id: 'c', name: 'Telegram Source', type: 'TELEGRAM', reason: 'telegram_not_configured' }] });
    (previewNewsCollection as jest.Mock).mockImplementation(async request => ({ id: 'operation', action: request.action, expires_at: new Date(Date.now() + 300000).toISOString(), snapshot: { readiness, scope: request.scope, sources: mockNewsData.data.filter(row => !request.ids || request.ids.includes(row.id)).map(row => ({ ...row, outcome: row.id === 'c' && request.action === 'enable' ? 'needs_configuration' : `will_${request.action}`, reason: row.id === 'c' ? 'telegram_not_configured' : undefined })) } }));
    (applyNewsCollection as jest.Mock).mockResolvedValue({ action: 'enable', changed: 1, excluded: 0 });
});
function mount() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><NewsSourcesManager standalone onBusyChange={() => {}} returnTo="/platform/news/sources" /></QueryClientProvider>);
}

it('provides a direct switch per source, with a clear disabled connection state', async () => {
    mount();const toggle = await screen.findByRole('switch', { name: 'Enable Daily News' });
    await waitFor(() => expect(toggle).toBeEnabled());
    expect(screen.getByRole('switch', { name: 'Enable Telegram Source' })).toBeDisabled();
    fireEvent.click(toggle);
    await waitFor(() => expect(applyNewsCollection).toHaveBeenCalledWith('operation'));
    expect(previewNewsCollection).toHaveBeenCalledWith({ action: 'enable', scope: 'selected', ids: ['a'] });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('puts only the matching rows into an explicit bulk review', async () => {
    mount();await screen.findByRole('button', { name: 'Enable all sources' });
    fireEvent.change(screen.getByRole('textbox', { name: 'Search sources' }), { target: { value: 'Daily' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all 1 matching sources' }));
    const toolbar = screen.getByRole('toolbar', { name: 'Selected sources' });
    expect(within(toolbar).getByText('1 selected')).toBeInTheDocument();
    fireEvent.click(within(toolbar).getByRole('button', { name: 'Enable selected' }));
    await screen.findByRole('dialog');
    expect(previewNewsCollection).toHaveBeenCalledWith({ action: 'enable', scope: 'selected', ids: ['a'] });
    expect(applyNewsCollection).not.toHaveBeenCalled();
});

it('takes connection warnings directly to the affected sources', async () => {
    mount();await screen.findByRole('button', { name: 'View 1 sources needing a connection' });
    fireEvent.click(screen.getByRole('button', { name: 'View 1 sources needing a connection' }));
    expect(screen.getByRole('switch', { name: 'Enable Telegram Source' })).toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: 'Enable Daily News' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Needs attention/ })).toHaveAttribute('aria-pressed', 'true');
});

it('exposes mixed selection and selects the matching sources with Space', async () => {
    const user = userEvent.setup();
    mount();
    const header = await screen.findByRole('checkbox', { name: 'Select all 3 matching sources' });
    expect(header).toHaveAttribute('aria-checked', 'false');
    await user.click(screen.getByRole('checkbox', { name: 'Select Daily News' }));
    expect(header).toBePartiallyChecked();
    header.focus();
    await user.keyboard(' ');
    expect(header).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Select Metro' })).toBeChecked();
});
