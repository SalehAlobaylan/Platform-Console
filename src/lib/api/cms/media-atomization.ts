import { cmsClient } from '@/lib/api/client';
import type {
    AtomizationFilters,
    MediaAtomizationChapter,
    MediaAtomizationParentContext,
    MediaAtomizationFeedUnit,
    MediaAtomizationOverview,
    MediaAtomizationParent,
    MediaAtomizationPipeline,
    MediaAtomizationPolicy,
    MediaAtomizationPolicyPatch,
    MediaAtomizationRepairResult,
    MediaAtomizationRun,
    MediaAtomizationSourcePolicy,
    MediaAtomizationSweepResult,
} from '@/types/platform/media-atomization';

interface CmsEnvelope<T> {
    data: T;
    code: number;
    message: string;
}

const unwrap = async <T>(promise: Promise<CmsEnvelope<T>>): Promise<T> => {
    return (await promise).data;
};

const asArray = <T>(value: T[] | null | undefined): T[] => Array.isArray(value) ? value : [];

const cleanParams = (filters?: AtomizationFilters & { limit?: number }) => {
    const params: Record<string, string | number> = {};
    Object.entries(filters ?? {}).forEach(([key, value]) => {
        if (value !== undefined && value !== null && String(value).trim() !== '') {
            params[key] = value;
        }
    });
    return params;
};

export const getMediaAtomizationOverview = () =>
    unwrap(cmsClient.get<CmsEnvelope<MediaAtomizationOverview>>('/admin/media-atomization/overview'));

export const getMediaAtomizationPolicy = () =>
    unwrap(cmsClient.get<CmsEnvelope<{ policy: MediaAtomizationPolicy }>>('/admin/media-atomization/policy'))
        .then((d) => d.policy);

export const updateMediaAtomizationPolicy = (patch: MediaAtomizationPolicyPatch) =>
    unwrap(cmsClient.patch<CmsEnvelope<{ policy: MediaAtomizationPolicy }>>('/admin/media-atomization/policy', patch))
        .then((d) => d.policy);

export const listMediaAtomizationSources = (filters?: { q?: string; limit?: number }) =>
    unwrap(cmsClient.get<CmsEnvelope<{ items: MediaAtomizationSourcePolicy[] }>>('/admin/media-atomization/sources', cleanParams(filters)))
        .then((d) => asArray(d?.items));

export const updateMediaAtomizationSourcePolicy = (sourceId: string, patch: MediaAtomizationPolicyPatch) =>
    unwrap(cmsClient.patch<CmsEnvelope<{ policy: MediaAtomizationPolicy }>>(`/admin/media-atomization/sources/${sourceId}/policy`, patch))
        .then((d) => d.policy);

export const getMediaAtomizationPipeline = (filters?: AtomizationFilters & { limit?: number; lane?: string; cursor?: string }) =>
    unwrap(
        cmsClient.get<CmsEnvelope<MediaAtomizationPipeline>>(
            '/admin/media-atomization/pipeline',
            cleanParams(filters)
        )
    ).then((d) => ({
        ...d,
        columns: asArray(d?.columns).map((column) => ({
            ...column,
            items: asArray(column?.items),
        })),
    }));

export const listMediaAtomizationParents = (filters?: AtomizationFilters & { limit?: number }) =>
    unwrap(
        cmsClient.get<CmsEnvelope<{ items: MediaAtomizationParent[] }>>(
            '/admin/media-atomization/parents',
            cleanParams(filters)
        )
    ).then((d) => asArray(d?.items));

export const getMediaAtomizationParentContext = (id: string) =>
    unwrap(
        cmsClient.get<CmsEnvelope<MediaAtomizationParentContext>>(
            `/admin/media-atomization/parents/${id}/context`
        )
    ).then((d) => ({
        ...d,
        chapters: asArray(d?.chapters),
        children: asArray(d?.children),
        recent_runs: asArray(d?.recent_runs),
    }));

export const listMediaAtomizationFeedUnits = (filters?: Pick<AtomizationFilters, 'path' | 'source' | 'q'> & { limit?: number }) =>
    unwrap(
        cmsClient.get<CmsEnvelope<{ items: MediaAtomizationFeedUnit[] }>>(
            '/admin/media-atomization/feed-units',
            cleanParams(filters)
        )
    ).then((d) => asArray(d?.items));

export const listMediaAtomizationChapters = (filters?: AtomizationFilters & { limit?: number }) =>
    unwrap(
        cmsClient.get<CmsEnvelope<{ items: MediaAtomizationChapter[] }>>(
            '/admin/media-atomization/chapters',
            cleanParams(filters)
        )
    ).then((d) => asArray(d?.items));

export const listMediaAtomizationRuns = (filters?: Pick<AtomizationFilters, 'status'> & { phase?: string; parent_id?: string; limit?: number }) =>
    unwrap(
        cmsClient.get<CmsEnvelope<{ items: MediaAtomizationRun[] }>>(
            '/admin/media-atomization/runs',
            cleanParams(filters)
        )
    ).then((d) => asArray(d?.items));

export const approveAtomizedChapter = (chapterId: string) =>
    unwrap(
        cmsClient.post<CmsEnvelope<{ chapter: MediaAtomizationChapter }>>(
            `/admin/media-atomization/chapters/${chapterId}/approve`
        )
    );

export const rejectAtomizedChapter = (chapterId: string) =>
    unwrap(
        cmsClient.post<CmsEnvelope<{ chapter: MediaAtomizationChapter }>>(
            `/admin/media-atomization/chapters/${chapterId}/reject`
        )
    );

export const repairMediaAtomizationLeaks = () =>
    unwrap(
        cmsClient.post<CmsEnvelope<MediaAtomizationRepairResult>>(
            '/admin/media-atomization/repair-leaks'
        )
    );

export const runMediaAtomizationSweep = () =>
    cmsClient.post<MediaAtomizationSweepResult>(
        '/admin/media-atomization/sweep-now'
    );

export const updateMediaAtomizationParentOverride = (parentId: string, override: 'inherit' | 'disabled' | 'enabled', reason?: string) =>
    unwrap(cmsClient.patch<CmsEnvelope<{ item: MediaAtomizationParent }>>(
        `/admin/media-atomization/parents/${parentId}/override`,
        { override, reason }
    ));

export const atomizeMediaParent = (parentId: string) =>
    cmsClient.post<MediaAtomizationSweepResult>(`/admin/media-atomization/parents/${parentId}/atomize`);

export const reatomizeMediaParent = (parentId: string) =>
    cmsClient.post<MediaAtomizationSweepResult>(`/admin/media-atomization/parents/${parentId}/reatomize`);
