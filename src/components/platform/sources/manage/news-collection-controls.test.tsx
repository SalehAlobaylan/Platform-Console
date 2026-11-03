import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NewsCollectionControls, NewsCollectionDialogs, useNewsCollectionManagement } from './news-collection-controls';
import { applyNewsCollection, getNewsCollection, previewNewsCollection } from '@/lib/api/cms/news-collection';

jest.mock('@/lib/api/cms/news-collection', () => ({ getNewsCollection: jest.fn(), previewNewsCollection: jest.fn(), applyNewsCollection: jest.fn() }));
jest.mock('@/hooks/use-sources', () => ({ sourceKeys: { all: ['sources'] } }));
jest.mock('@/hooks/use-discovery', () => ({ discoveryKeys: { all: ['discovery'] } }));
jest.mock('@/components/ui/toast', () => ({ toast: jest.fn() }));

const status = { environment: 'local', tenant_id: 'default', total: 2, enabled: 0, can_manage: true, operations: [], readiness: { ready: true, paused: false, control_version: 0, blockers: [] } };
const preview = { id: 'frozen-operation', action: 'enable', expires_at: new Date(Date.now() + 300000).toISOString(), snapshot: { scope: 'all', readiness: status.readiness, sources: [{ id: 'a', name: 'RSS source', type: 'RSS', outcome: 'will_enable' }, { id: 'b', name: 'Telegram source', type: 'TELEGRAM', outcome: 'needs_configuration', reason: 'telegram_not_configured' }] } };

function Controls({ changed }: { changed: () => void }) {
    const collection = useNewsCollectionManagement(changed);
    return <><NewsCollectionControls collection={collection} /><NewsCollectionDialogs collection={collection} /></>;
}

describe('News source actions', () => {
    beforeEach(() => {
        jest.resetAllMocks();
        (getNewsCollection as jest.Mock).mockResolvedValue(status);
        (previewNewsCollection as jest.Mock).mockResolvedValue(preview);
        (applyNewsCollection as jest.Mock).mockResolvedValue({ id: preview.id, action: 'enable', changed: 1, unchanged: 0, excluded: 1 });
    });
    function mount() {
        const changed = jest.fn();
        const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
        render(<QueryClientProvider client={client}><Controls changed={changed} /></QueryClientProvider>);
        return { changed };
    }
    async function review() {
        const button = await screen.findByRole('button', { name: 'Enable all sources' });
        await waitFor(() => expect(button).toBeEnabled());
        fireEvent.click(button);
        return screen.findByRole('button', { name: 'Enable 1 source' });
    }
    it('shows one setup action and reviews exclusions before applying the captured operation', async () => {
        const { changed } = mount();
        const apply = await review();
        expect(await screen.findByText('1 source will stay disabled')).toBeInTheDocument();
        expect(screen.getByText('Connect Telegram in this environment to use these sources.')).toBeInTheDocument();
        expect(screen.queryByText(/tenant default/)).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Manage sources' })).not.toBeInTheDocument();
        expect(previewNewsCollection).toHaveBeenCalledWith({ action: 'enable', scope: 'all', ids: undefined });
        fireEvent.click(apply);
        await waitFor(() => expect(applyNewsCollection).toHaveBeenCalledWith('frozen-operation'));
        await waitFor(() => expect(changed).toHaveBeenCalledTimes(1));
    });
    it('does not submit when a batch review is cancelled', async () => {
        mount(); await review(); fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(applyNewsCollection).not.toHaveBeenCalled();
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    it('turns missing setup into an actionable blocker', async () => {
        (previewNewsCollection as jest.Mock).mockResolvedValue({ ...preview, snapshot: { ...preview.snapshot, readiness: { ...status.readiness, ready: false, blockers: ['news_admission_unavailable'] } } });
        mount();const apply = await review();
        expect(apply).toBeDisabled();
        expect(screen.getByRole('link', { name: 'Check setup' })).toHaveAttribute('href', '/platform/system-health');
        expect(applyNewsCollection).not.toHaveBeenCalled();
    });
    it('pauses in one click without an unnecessary confirmation', async () => {
        (getNewsCollection as jest.Mock).mockResolvedValue({ ...status, enabled: 1 });
        (previewNewsCollection as jest.Mock).mockResolvedValue({ ...preview, action: 'pause', snapshot: { ...preview.snapshot, sources: [] } });
        mount();const pause = await screen.findByRole('button', { name: 'Pause updates' });
        fireEvent.click(pause);
        await waitFor(() => expect(applyNewsCollection).toHaveBeenCalledWith('frozen-operation'));
        expect(previewNewsCollection).toHaveBeenCalledWith({ action: 'pause', scope: 'all' });
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    it('resumes the enabled roster without opening a source-selection review', async () => {
        (getNewsCollection as jest.Mock).mockResolvedValue({ ...status, enabled: 1, readiness: { ...status.readiness, paused: true } });
        (previewNewsCollection as jest.Mock).mockResolvedValue({ ...preview, action: 'resume', snapshot: { ...preview.snapshot, sources: [] } });
        mount(); fireEvent.click(await screen.findByRole('button', { name: 'Resume updates' }));
        await waitFor(() => expect(applyNewsCollection).toHaveBeenCalledWith('frozen-operation'));
        expect(previewNewsCollection).toHaveBeenCalledWith({ action: 'resume', scope: 'all' });
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    it('offers connection help and a new check when every selected source is blocked', async () => {
        (previewNewsCollection as jest.Mock).mockResolvedValue({ ...preview, snapshot: { ...preview.snapshot, sources: [preview.snapshot.sources[1]] } });
        mount();
        const enable = await screen.findByRole('button', { name: 'Enable all sources' });
        await waitFor(() => expect(enable).toBeEnabled()); fireEvent.click(enable);
        expect(await screen.findByRole('heading', { name: 'No sources are ready to enable' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Enable 0 sources' })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Check again' }));
        await waitFor(() => expect(previewNewsCollection).toHaveBeenCalledTimes(2));
        expect(applyNewsCollection).not.toHaveBeenCalled();
    });
    it('retries an uncertain submission with the same operation', async () => {
        (applyNewsCollection as jest.Mock).mockRejectedValueOnce({ message: 'Connection lost', status: 0 });
        const { changed } = mount();fireEvent.click(await review());
        expect(await screen.findByRole('alert')).toHaveTextContent('Connection lost');
        expect(changed).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'Retry: Enable 1 source' }));
        await waitFor(() => expect(changed).toHaveBeenCalledTimes(1));
        expect((applyNewsCollection as jest.Mock).mock.calls.map(call => call[0])).toEqual(['frozen-operation', 'frozen-operation']);
    });
    it('requests a fresh review after a definite stale-preview conflict', async () => {
        (applyNewsCollection as jest.Mock).mockRejectedValueOnce({ message: 'Source changed', status: 409 });
        mount();fireEvent.click(await review());
        fireEvent.click(await screen.findByRole('button', { name: 'Refresh review' }));
        await waitFor(() => expect(previewNewsCollection).toHaveBeenCalledTimes(2));
        expect(applyNewsCollection).toHaveBeenCalledTimes(1);
    });
    it('keeps mutation controls disabled for read-only users', async () => {
        (getNewsCollection as jest.Mock).mockResolvedValue({ ...status, can_manage: false });
        mount();expect(await screen.findByRole('button', { name: 'Enable all sources' })).toBeDisabled();
    });
});
