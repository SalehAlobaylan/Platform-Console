import { readCookie } from '@/lib/server/session-cookies';
import type {
    AiMetricsSnapshot,
    CountByStatus,
    EnrichmentMetrics,
    LlmMetrics,
    MediaMetrics,
} from '@/types/platform/ai-metrics';

const ACCESS_COOKIE = 'console_access_token';
const PROBE_TIMEOUT_MS = 3000;

// ── Prometheus text parsing ─────────────────────────────────

interface Sample {
    name: string;
    labels: Record<string, string>;
    value: number;
}

function parseProm(text: string): Sample[] {
    const samples: Sample[] = [];
    const labelRe = /([a-zA-Z_][a-zA-Z0-9_]*)="((?:[^"\\]|\\.)*)"/g;

    for (const raw of text.split('\n')) {
        const line = raw.trim();
        if (!line || line.startsWith('#')) continue;

        let name: string;
        let labelStr = '';
        let rest: string;

        const brace = line.indexOf('{');
        if (brace !== -1) {
            const close = line.indexOf('}', brace);
            if (close === -1) continue;
            name = line.slice(0, brace);
            labelStr = line.slice(brace + 1, close);
            rest = line.slice(close + 1).trim();
        } else {
            const sp = line.indexOf(' ');
            if (sp === -1) continue;
            name = line.slice(0, sp);
            rest = line.slice(sp + 1).trim();
        }

        const value = Number(rest.split(/\s+/)[0]);
        if (Number.isNaN(value)) continue;

        const labels: Record<string, string> = {};
        if (labelStr) {
            labelRe.lastIndex = 0;
            let m: RegExpExecArray | null;
            while ((m = labelRe.exec(labelStr))) labels[m[1]] = m[2];
        }
        samples.push({ name, labels, value });
    }
    return samples;
}

type LabelFilter = (labels: Record<string, string>) => boolean;

function sum(samples: Sample[], name: string, filter?: LabelFilter): number {
    return samples
        .filter((s) => s.name === name && (!filter || filter(s.labels)))
        .reduce((acc, s) => acc + s.value, 0);
}

function gauge(samples: Sample[], name: string): number | null {
    const s = samples.find((x) => x.name === name);
    return s ? s.value : null;
}

// Average from a Prometheus histogram = sum(_sum) / sum(_count) across labels.
function avgFromHist(samples: Sample[], base: string): number | null {
    const total = sum(samples, `${base}_sum`);
    const count = sum(samples, `${base}_count`);
    return count > 0 ? total / count : null;
}

// ── Aggregation ─────────────────────────────────────────────

function byStatus(samples: Sample[], name: string): CountByStatus {
    const success = sum(samples, name, (l) => l.status === 'success');
    const total = sum(samples, name);
    return { success, error: total - success, total };
}

function aggregateMedia(samples: Sample[]): MediaMetrics {
    const jobState = (state: string) =>
        sum(samples, 'media_transcribe_jobs_total', (l) => l.state === state);
    const wbSuccess = sum(samples, 'media_cms_writeback_total', (l) => l.status === 'success');
    const wbTotal = sum(samples, 'media_cms_writeback_total');

    return {
        transcriptions: byStatus(samples, 'media_transcriptions_total'),
        imageEmbeddings: byStatus(samples, 'media_image_embeddings_total'),
        transcribeJobs: {
            queued: jobState('queued'),
            started: jobState('started'),
            completed: jobState('completed'),
            failed: jobState('failed'),
        },
        transcriptionAvgSec: avgFromHist(samples, 'media_transcription_duration_seconds'),
        writebackSuccessRate: wbTotal > 0 ? wbSuccess / wbTotal : null,
    };
}

function aggregateEnrichment(samples: Sample[]): EnrichmentMetrics {
    const dropped = (rule: string) =>
        sum(samples, 'enrichment_ranking_rules_dropped_total', (l) => l.rule === rule);

    return {
        embeddings: byStatus(samples, 'enrichment_embeddings_total'),
        translations: byStatus(samples, 'enrichment_translations_total'),
        summarizations: byStatus(samples, 'enrichment_summarizations_total'),
        relatedRequests: sum(samples, 'enrichment_related_requests_total'),
        relatedAvgSec: avgFromHist(samples, 'enrichment_related_duration_seconds'),
        rerankRequests: sum(samples, 'enrichment_rerank_requests_total'),
        rerankAvgSec: avgFromHist(samples, 'enrichment_rerank_duration_seconds'),
        feedNewsRequests: sum(samples, 'enrichment_feed_news_requests_total'),
        feedNewsAvgSec: avgFromHist(samples, 'enrichment_feed_news_duration_seconds'),
        rrfOverlapRatio: gauge(samples, 'enrichment_rrf_fusion_overlap_ratio'),
        rankingDropped: {
            freshness: dropped('freshness'),
            source_diversity: dropped('source_diversity'),
            type_quotas: dropped('type_quotas'),
        },
    };
}

function aggregateLlm(samples: Sample[]): LlmMetrics {
    const requestsByProvider: Record<string, { success: number; failure: number }> = {};
    for (const s of samples.filter((x) => x.name === 'enrichment_llm_requests_total')) {
        const p = s.labels.provider ?? 'unknown';
        requestsByProvider[p] ??= { success: 0, failure: 0 };
        if (s.labels.status === 'success') requestsByProvider[p].success += s.value;
        else requestsByProvider[p].failure += s.value;
    }

    const errorsByType: Record<string, number> = {};
    const errorsByProvider: Record<string, number> = {};
    for (const s of samples.filter((x) => x.name === 'enrichment_llm_errors_total')) {
        const et = s.labels.error_type ?? 'other';
        const p = s.labels.provider ?? 'unknown';
        errorsByType[et] = (errorsByType[et] ?? 0) + s.value;
        errorsByProvider[p] = (errorsByProvider[p] ?? 0) + s.value;
    }

    const cacheHits = sum(samples, 'enrichment_llm_cache_hits_total');
    const cacheMisses = sum(samples, 'enrichment_llm_cache_misses_total');
    const cacheTotal = cacheHits + cacheMisses;

    return {
        requestsByProvider,
        cacheHits,
        cacheMisses,
        cacheHitRate: cacheTotal > 0 ? cacheHits / cacheTotal : null,
        fallbackInvocations: sum(samples, 'enrichment_llm_fallback_invocations_total'),
        retries: sum(samples, 'enrichment_llm_retries_total'),
        errorsByType,
        errorsByProvider,
        avgLatencySec: avgFromHist(samples, 'enrichment_llm_request_duration_seconds'),
    };
}

// ── Scrape ──────────────────────────────────────────────────

async function scrape(
    baseUrl: string | undefined
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
    if (!baseUrl) return { ok: false, error: 'base URL not configured' };
    // Trim — a stray space in a *_BASE_URL env would make this URL unparseable.
    const url = `${baseUrl.trim().replace(/\/$/, '')}/metrics`;
    try {
        const resp = await fetch(url, {
            cache: 'no-store',
            signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
        });
        if (!resp.ok) return { ok: false, error: `HTTP ${resp.status}` };
        return { ok: true, text: await resp.text() };
    } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'scrape failed' };
    }
}

export async function GET(request: Request): Promise<Response> {
    // Require an authenticated console session — these are internal operational
    // metrics, not public data, matching the other admin API routes.
    const accessToken = readCookie(request, ACCESS_COOKIE);
    if (!accessToken) {
        return Response.json({ message: 'Not authenticated' }, { status: 401 });
    }

    const [mediaRes, enrichRes] = await Promise.all([
        scrape(process.env.MEDIA_BASE_URL),
        scrape(process.env.ENRICHMENT_BASE_URL),
    ]);

    let media: MediaMetrics | null = null;
    let enrichment: EnrichmentMetrics | null = null;
    let llm: LlmMetrics | null = null;
    const errors: { media?: string; enrichment?: string } = {};

    if (mediaRes.ok) media = aggregateMedia(parseProm(mediaRes.text));
    else errors.media = mediaRes.error;

    if (enrichRes.ok) {
        const samples = parseProm(enrichRes.text);
        enrichment = aggregateEnrichment(samples);
        llm = aggregateLlm(samples);
    } else {
        errors.enrichment = enrichRes.error;
    }

    return Response.json({
        timestamp: new Date().toISOString(),
        media,
        enrichment,
        llm,
        errors,
    });
}
