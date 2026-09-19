import { fireEvent, render, screen } from '@testing-library/react';
import { EpisodeContextTab } from './episode-context-tabs';
import { useEpisodeJourney } from './media-journey';
import type { MediaJourney } from '@/lib/api/cms/media-journey';

jest.mock('next/navigation', () => ({
    usePathname: () => '/platform/media/atomization',
    useSearchParams: () => new URLSearchParams('tab=policy&item=selected&chapter=child'),
}));
jest.mock('./journey-actions', () => ({ JourneyActions: () => <span>Registered actions</span> }));
jest.mock('./media-journey', () => ({
    useEpisodeJourney: jest.fn(),
    useJourneyLocale: () => 'en',
    MediaJourneyGuide: () => <span>Journey guide</span>,
    PageEvidence: ({ id, section }: { id: string; section: string }) => <div data-testid={`evidence-${section}`}>{id}</div>,
}));

const snapshot: MediaJourney = {
    parent: { id: 'canonical-parent', title: 'Selected episode' },
    acquisition_mode: 'manual', auto_stt_enabled: false,
    capacity: { waiting: true }, updated_at: '2026-09-15T12:00:00Z',
    steps: [{ key: 'transcript', required: true, state: 'waiting', reason_code: 'predecessor_required' }],
};
const mockQuery = jest.mocked(useEpisodeJourney);
beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.mockReturnValue({ data: snapshot, dataUpdatedAt: Date.parse(snapshot.updated_at), isError: false, refetch: jest.fn() } as unknown as ReturnType<typeof useEpisodeJourney>);
});

it('keeps episode and chapter context when opening the journey or guide', () => {
    render(<EpisodeContextTab id="selected" mode="policy" />);
    expect(screen.getByRole('link', { name: 'Open journey' })).toHaveAttribute('href', '/platform/media/atomization?tab=workflow&item=selected&chapter=child');
    expect(screen.getByRole('link', { name: 'Transcript' })).toHaveAttribute('href', '/platform/media/atomization?tab=policy&item=selected&chapter=child&guide=transcript');
});

it('distinguishes capacity and predecessor waits without inventing a slot holder', () => {
    render(<EpisodeContextTab id="selected" mode="diagnostics" />);
    expect(screen.getByText('What should I do next?')).toBeInTheDocument();
    expect(screen.getAllByText('Open the preceding step listed in the journey and complete or wait for it. This is a dependency, not an approval request.').length).toBeGreaterThan(0);
    expect(screen.getByText('Waiting for shared processing capacity.')).toBeInTheDocument();
    expect(screen.getAllByText('Waiting for the preceding requirement, not an approval.').length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: 'Open slot holder' })).not.toBeInTheDocument();
});

it('loads detailed evidence only on expansion and uses the resolved episode', () => {
    render(<EpisodeContextTab id="selected" mode="diagnostics" />);
    expect(screen.queryByTestId('evidence-events')).not.toBeInTheDocument();
    expect(screen.queryByTestId('evidence-chapters')).not.toBeInTheDocument();
    const details = screen.getByText('Execution and event history').closest('details')!;
    details.open = true;
    fireEvent(details, new Event('toggle'));
    expect(screen.getByTestId('evidence-events')).toHaveTextContent('canonical-parent');
    expect(screen.queryByTestId('evidence-chapters')).not.toBeInTheDocument();
});

it('does not request an arbitrary episode when there is no selection', () => {
    render(<EpisodeContextTab id={null} mode="policy" />);
    expect(mockQuery).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'Choose an episode' })).toBeInTheDocument();
});
