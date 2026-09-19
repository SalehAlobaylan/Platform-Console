import { journeyGuide, journeyNextAction, journeyReason, journeyState } from './journey-guide';

describe('media journey guidance', () => {
    it('documents every step in both languages without network generation', () => {
        expect(Object.keys(journeyGuide)).toEqual(['discovery','download','preparation','transcript','planning','cutting','review','readiness','published']);
        for (const step of Object.values(journeyGuide)) for (const locale of ['en','ar'] as const) for (const key of ['title','happens','waits','action','next'] as const) expect(step[locale][key].length).toBeGreaterThan(key === 'title' ? 0 : 5);
    });
    it('distinguishes predecessor waits from operator approvals', () => {
        expect(journeyReason('predecessor_required','en')).toContain('not an approval');
        expect(journeyReason('transcript_approval','en')).toContain('permission');
    });
    it('keeps unknown codes visible and never calls them failures', () => {
        expect(journeyReason('future_condition','en')).toContain('future_condition');
        expect(journeyReason('future_condition','ar')).toContain('future_condition');
        expect(journeyState('waiting','ar')).toBe('بانتظار متطلب');
    });
    it('turns common diagnostic conditions into safe operator actions', () => {
        expect(journeyNextAction('predecessor_required', 'en')).toContain('not an approval');
        expect(journeyNextAction('effects_unresolved', 'en')).toContain('reconcile');
        expect(journeyNextAction('download_approval', 'ar')).toContain('تنزيل ومعالجة');
        expect(journeyNextAction('future_condition', 'en', 'transcript')).toContain('Generate transcript');
        expect(journeyState('blocked', 'ar')).toBe('محجوب بتبعية');
    });
});
