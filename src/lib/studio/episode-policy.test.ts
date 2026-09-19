import type { MediaJourney } from '@/lib/api/cms/media-journey';
import { episodePolicyRows, policyOrigin } from './episode-policy';

const snapshot: MediaJourney = { parent: { id: 'episode' }, steps: [], capacity: { waiting: false }, acquisition_mode: 'manual', acquisition_policy_source: 'source_override', auto_stt_enabled: false, policy_source: 'episode', updated_at: '2026-09-15T12:00:00Z' };

describe('episode policy presentation', () => {
    it('does not turn missing policy fields into enabled defaults', () => {
        const rows = episodePolicyRows(snapshot, 'en');
        expect(rows.find(row => row.key === 'chaptering')?.value).toBe('Unavailable');
        expect(rows.find(row => row.key === 'download')).toMatchObject({ value: 'Manual', origin: 'Source override' });
        expect(rows.find(row => row.key === 'transcript')?.value).toBe('Disabled');
    });
    it('does not claim aggregate policy provenance is field-level provenance', () => {
        const rows = episodePolicyRows({ ...snapshot, effective_policy: { chaptering_enabled: true, high_confidence_threshold: 0 } }, 'en');
        expect(rows.find(row => row.key === 'chaptering')).toMatchObject({ value: 'Enabled', origin: 'Resolved policy' });
        expect(rows.find(row => row.key === 'confidence')?.value).toBe('0');
    });
    it('localizes guidance and retains unknown origins honestly', () => {
        expect(episodePolicyRows(snapshot, 'ar').find(row => row.key === 'download')).toMatchObject({ value: 'يدوي', origin: 'تجاوز المصدر' });
        expect(policyOrigin(undefined, 'en')).toBe('Unavailable');
        expect(policyOrigin('future_source', 'en')).toBe('future_source');
    });
});
