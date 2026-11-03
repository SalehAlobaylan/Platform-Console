import { newsSourceHealth } from './news-health';

describe('News provider evidence', () => {
    it('does not infer success from activation or article dates', () => {
        expect(newsSourceHealth({}).status).toBe('new');
        expect(newsSourceHealth({ last_attempted_at: new Date().toISOString() }).status).toBe('unknown');
    });
    it('keeps a successful empty pull healthy', () => {
        expect(newsSourceHealth({ last_provider_success_at: '2026-11-01T00:00:00Z', failure_streak: 0 }).status).toBe('live');
    });
    it('shows current failures and circuit backoff independently', () => {
        expect(newsSourceHealth({ last_provider_success_at: '2026-11-01T00:00:00Z', failure_streak: 1 }).status).toBe('stale');
        expect(newsSourceHealth({ intake_circuit_until: new Date(Date.now() + 60000).toISOString() }).status).toBe('stale');
    });
});
