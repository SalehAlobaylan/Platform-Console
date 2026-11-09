import { leavesStudioDraft } from './history-guard';

const studio = {
    pathname: '/platform/media/atomization',
    search: { tab: 'studio', item: 'episode' },
};

test('preserves the draft for same-item chapter and filter changes', () => {
    expect(leavesStudioDraft(studio, { ...studio, search: { ...studio.search, chapter: '2', q: 'term' } })).toBe(false);
});

test('guards departures, item changes, and tab changes', () => {
    expect(leavesStudioDraft(studio, { pathname: '/platform/news', search: {} })).toBe(true);
    expect(leavesStudioDraft(studio, { ...studio, search: { ...studio.search, item: 'other' } })).toBe(true);
    expect(leavesStudioDraft(studio, { ...studio, search: { ...studio.search, tab: 'workflow' } })).toBe(true);
});
