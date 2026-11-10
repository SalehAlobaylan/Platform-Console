import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { AttentionPreview } from '@/components/platform/overview/attention-preview';
import type { OpsAttentionItem, OpsAttentionPage } from '@/lib/api/cms/operations';

const item = (overrides: Partial<OpsAttentionItem>): OpsAttentionItem =>
    ({
        key: 'k1',
        fingerprint: 'k1',
        system: 'feed-integrity',
        kind: 'episode',
        severity: 'major',
        title: 'Pods serving duplicate items',
        detail: 'edge_pods_dup confirmed twice',
        count: 1,
        first_seen: new Date(Date.now() - 30 * 60_000).toISOString(),
        href: '/platform/feed-integrity',
        snoozed: false,
        ...overrides,
    }) as OpsAttentionItem;

const snapshot = (items: OpsAttentionItem[], total = items.length): OpsAttentionPage => ({
    items, total, as_of: new Date().toISOString(), complete: true,
    adapter_errors: [], offset: 0, limit: 1, has_more: total > 1,
});

describe('AttentionPreview', () => {
    it('shows the owner total and only the first unsnoozed issue', () => {
        const issues = [item({ snoozed: true, title: 'Snoozed issue' }), item({ key: 'k2' }), item({ key: 'k3', title: 'Another issue' })];
        render(<AttentionPreview snapshot={snapshot(issues, 26)} isLoading={false} isError={false} onRetry={jest.fn()} />);
        expect(screen.getByText('major')).toBeInTheDocument();
        expect(screen.getByText('26 open')).toBeInTheDocument();
        expect(screen.queryByText('Snoozed issue')).not.toBeInTheDocument();
        expect(screen.queryByText('Another issue')).not.toBeInTheDocument();
        expect(screen.queryByText(/confirmed twice/)).not.toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Pods serving duplicate items' })).toHaveAttribute(
            'href',
            '/platform/feed-integrity',
        );
        expect(screen.getByRole('link', { name: 'Open inbox' })).toHaveAttribute('href', '/platform/operations#ops-attention');
    });

    it('shows the all-clear empty state', () => {
        render(<AttentionPreview snapshot={snapshot([])} isLoading={false} isError={false} onRetry={jest.fn()} />);
        expect(screen.getByText('Nothing needs attention right now.')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Open inbox' })).toBeInTheDocument();
    });

    it('shows the error state with a working retry', async () => {
        const onRetry = jest.fn();
        render(<AttentionPreview isLoading={false} isError onRetry={onRetry} />);
        expect(screen.getByText('Attention inbox unavailable')).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
        expect(onRetry).toHaveBeenCalled();
    });

    it('keeps stale results and withholds all-clear for partial empty evidence', () => {
        const props = { isLoading: false, isError: false, onRetry: jest.fn() };
        const { rerender } = render(<AttentionPreview {...props} snapshot={snapshot([item({})], 26)} isError />);
        expect(screen.getByRole('link', { name: 'Pods serving duplicate items' })).toBeInTheDocument();
        expect(screen.getByText(/Stale attention snapshot/)).toBeInTheDocument();
        expect(screen.queryByText('26 open')).not.toBeInTheDocument();
        rerender(<AttentionPreview {...props} snapshot={{ ...snapshot([]), complete: false }} />);
        expect(screen.getByText('Some systems did not report')).toBeInTheDocument();
        expect(screen.queryByText('Nothing needs attention right now.')).not.toBeInTheDocument();
    });

    it('shows a compact loading state', () => {
        render(<AttentionPreview isLoading isError={false} onRetry={jest.fn()} />);
        expect(screen.getByText('Checking attention…')).toBeInTheDocument();
        expect(screen.queryByText('Nothing needs attention right now.')).not.toBeInTheDocument();
    });
});
