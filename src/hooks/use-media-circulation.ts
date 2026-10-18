import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    applyMediaCirculationRecommendation,
    createMediaCirculationOverride,
    deleteMediaCirculationOverride,
    dismissMediaCirculationRecommendation,
    elevateMediaAutopilot,
    generateMediaCirculationRecommendations,
    getMediaAutopilotRun,
    getMediaCirculationCockpit,
    getMediaSupplyStatus,
    listMediaSupplyActionHistory,
	    listMediaSupplyEligibleActions,
	    createMediaSupplyActionPreview,
	    confirmMediaSupplyActionPreview,
	    getMediaSupplyAction,
	    cancelMediaSupplyAction,
	    listMediaSupplyActionEvents,
	    getMediaSupplyQualificationState,
    getMediaSourceRunTrace,
    getMediaCirculationHealth,
    getMediaSourceDiversity,
    getMediaCirculationPolicy,
    getMediaIntelligenceDiagnostics,
    listMediaAutopilotRuns,
    listMediaCirculationRecommendations,
    listMediaCirculationOverrides,
    listMediaSupplyEpisodes,
    pauseMediaAutopilot,
    revertMediaCirculationRecommendation,
    runMediaAutopilotNow,
    updateMediaCirculationPolicy,
} from '@/lib/api/cms/media-circulation';
import type {
    MediaAutopilotElevatedMode,
    MediaCirculationOverrideRequest,
    MediaCirculationPolicy,
    RecommendationUnitType,
} from '@/types/platform/media-circulation';
import { toast } from '@/components/ui/toast';
import { CACHE_CONFIG } from '@/app/providers';

export const mediaCirculationKeys = {
    all: ['media-circulation'] as const,
    cockpit: () => [...mediaCirculationKeys.all, 'cockpit'] as const,
    health: () => [...mediaCirculationKeys.all, 'health'] as const,
    diversity: () => [...mediaCirculationKeys.all, 'source-diversity'] as const,
    policy: () => [...mediaCirculationKeys.all, 'policy'] as const,
    overrides: () => [...mediaCirculationKeys.all, 'overrides'] as const,
    intelligence: () => [...mediaCirculationKeys.all, 'intelligence'] as const,
    recommendations: (unitType: RecommendationUnitType, status: string) => [...mediaCirculationKeys.all, 'recommendations', unitType, status] as const,
    autopilotRuns: () => [...mediaCirculationKeys.all, 'autopilot-runs'] as const,
    autopilotRun: (id: string) => [...mediaCirculationKeys.all, 'autopilot-run', id] as const,
    sourceRunTrace: (id: string) => [...mediaCirculationKeys.all, 'source-run-trace', id] as const,
    supply: () => [...mediaCirculationKeys.all, 'supply'] as const,
    supplyEpisodes: () => [...mediaCirculationKeys.all, 'supply-episodes'] as const,
    supplyEpisodeActions: (id: string) => [...mediaCirculationKeys.all, 'supply-episode-actions', id] as const,
    supplyActionHistory: (id: string) => [...mediaCirculationKeys.all, 'supply-action-history', id] as const,
    supplyAction: (id: string) => [...mediaCirculationKeys.all, 'supply-action', id] as const,
    supplyActionEvents: (id: string) => [...mediaCirculationKeys.all, 'supply-action-events', id] as const,
	supplyQualification: () => [...mediaCirculationKeys.all, 'supply-qualification'] as const,
};

// ---- Autopilot (stage 5) ----

export function useMediaAutopilotRuns(limit = 20) {
    return useQuery({
        queryKey: [...mediaCirculationKeys.autopilotRuns(), limit],
        queryFn: () => listMediaAutopilotRuns(limit),
        staleTime: CACHE_CONFIG.lists.staleTime,
        gcTime: CACHE_CONFIG.lists.gcTime,
        refetchInterval: 60_000,
        refetchIntervalInBackground: false,
        select: (resp) => resp.data.items,
    });
}

export function useMediaAutopilotRun(id: string | null) {
    return useQuery({
        queryKey: mediaCirculationKeys.autopilotRun(id ?? 'none'),
        queryFn: () => getMediaAutopilotRun(id as string),
        enabled: Boolean(id),
        staleTime: CACHE_CONFIG.lists.staleTime,
        gcTime: CACHE_CONFIG.lists.gcTime,
        select: (resp) => resp.data,
    });
}

export function useMediaSourceRunTrace(id: string | null) {
    return useQuery({
        queryKey: mediaCirculationKeys.sourceRunTrace(id ?? 'none'),
        queryFn: () => getMediaSourceRunTrace(id as string),
        enabled: Boolean(id),
        staleTime: CACHE_CONFIG.details.staleTime,
        gcTime: CACHE_CONFIG.details.gcTime,
        retry: 1,
    });
}

export function useRunMediaAutopilotNow() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: runMediaAutopilotNow,
        onSuccess: (resp) => {
            queryClient.invalidateQueries({
                queryKey: mediaCirculationKeys.all,
            });
            toast({
                title: `Autopilot run ${resp.data.run.status}`,
                description: resp.data.run.summary ?? '',
                variant: resp.data.run.status === 'failed' ? 'destructive' : 'success',
            });
        },
        onError: (err: Error) => {
            toast({
                title: 'Autopilot run failed',
                description: err.message,
                variant: 'destructive',
            });
        },
    });
}

export function usePauseMediaAutopilot() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (minutes: number) => pauseMediaAutopilot(minutes),
        onSuccess: (resp) => {
            queryClient.invalidateQueries({
                queryKey: mediaCirculationKeys.all,
            });
            toast({
                title: resp.data.paused_until ? 'Autopilot paused' : 'Autopilot resumed',
                variant: 'success',
            });
        },
        onError: (err: Error) => {
            toast({
                title: 'Pause failed',
                description: err.message,
                variant: 'destructive',
            });
        },
    });
}

export function useElevateMediaAutopilot() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ mode, minutes }: { mode: MediaAutopilotElevatedMode | ''; minutes?: number }) => elevateMediaAutopilot(mode, minutes),
        onSuccess: (resp) => {
            queryClient.invalidateQueries({
                queryKey: mediaCirculationKeys.all,
            });
            toast({
                title: resp.data.mode ? `Elevated mode: ${resp.data.mode}` : 'Elevated mode cleared',
                variant: 'success',
            });
        },
        onError: (err: Error) => {
            toast({
                title: 'Elevate failed',
                description: err.message,
                variant: 'destructive',
            });
        },
    });
}

export function useMediaIntelligenceDiagnostics() {
    return useQuery({
        queryKey: mediaCirculationKeys.intelligence(),
        queryFn: getMediaIntelligenceDiagnostics,
        staleTime: CACHE_CONFIG.lists.staleTime,
        gcTime: CACHE_CONFIG.lists.gcTime,
        refetchInterval: 60_000,
        refetchIntervalInBackground: false,
        refetchOnWindowFocus: false,
    });
}

export function useMediaCirculationCockpit() {
    return useQuery({
        queryKey: mediaCirculationKeys.cockpit(),
        queryFn: getMediaCirculationCockpit,
        staleTime: CACHE_CONFIG.lists.staleTime,
        gcTime: CACHE_CONFIG.lists.gcTime,
        refetchInterval: 60_000,
        refetchIntervalInBackground: false,
        refetchOnWindowFocus: false,
    });
}

// Supply Continuity is an operational evidence view, not a live queue monitor.
// Its CMS read model is deliberately expensive (it joins schedule, delivery,
// exposure, readiness, and bounded metrics), so keep polling bounded and avoid
// focus-triggered bursts when several Console tabs are open. Actions still use
// their own cursor lifecycle polling below.
export function useMediaSupplyStatus() {
    return useQuery({
        queryKey: mediaCirculationKeys.supply(),
		meta: { affectedDomains: ['media_circulation'] },
        queryFn: getMediaSupplyStatus,
        staleTime: 30_000,
        gcTime: CACHE_CONFIG.lists.gcTime,
        refetchInterval: 60_000,
        refetchIntervalInBackground: false,
        refetchOnWindowFocus: false,
        retry: 1,
    });
}

export function useMediaSupplyEpisodes(limit = 8, cursor = '', enabled = true) {
    return useQuery({
        queryKey: [...mediaCirculationKeys.supplyEpisodes(), limit, cursor],
        enabled,
		meta: { affectedDomains: ['media_circulation'] },
        queryFn: ({ signal }) => listMediaSupplyEpisodes(limit, cursor, signal),
        staleTime: 60_000,
        gcTime: CACHE_CONFIG.lists.gcTime,
        refetchInterval: 120_000,
        refetchIntervalInBackground: false,
        refetchOnWindowFocus: false,
        retry: 1,
    });
}

export function useMediaSupplyActionHistory(episodeID: string, cursor = '') {
 return useQuery({ queryKey: [...mediaCirculationKeys.supplyActionHistory(episodeID), cursor], queryFn: ({ signal }) => listMediaSupplyActionHistory(episodeID, cursor, signal), enabled: Boolean(episodeID), staleTime: 0, refetchInterval: 10_000, refetchIntervalInBackground: false, retry: 2, retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 8_000) });
}

export function useMediaSupplyEligibleActions(episodeID: string | null) {
    return useQuery({
        queryKey: mediaCirculationKeys.supplyEpisodeActions(episodeID ?? 'none'),
        queryFn: () => listMediaSupplyEligibleActions(episodeID as string),
        enabled: Boolean(episodeID),
        staleTime: 10_000,
        gcTime: CACHE_CONFIG.details.gcTime,
        retry: 1,
    });
}

const supplyActionInFlight = new Set(['queued', 'claimed', 'running', 'verifying', 'uncertain']);

export function useMediaSupplyAction(actionID: string | null) {
    const queryClient = useQueryClient();
    const invalidatedState = useRef<string | null>(null);
    const query = useQuery({
        queryKey: mediaCirculationKeys.supplyAction(actionID ?? 'none'),
        queryFn: ({ signal }) => getMediaSupplyAction(actionID as string, signal),
        enabled: Boolean(actionID),
        staleTime: 0,
        gcTime: CACHE_CONFIG.details.gcTime,
		retry: 3,
		retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 8_000),
        refetchInterval: (query) => supplyActionInFlight.has(query.state.data?.state ?? '') ? 3_000 : false,
        refetchIntervalInBackground: false,
    });
	useEffect(() => {
		const action = query.data;
		if (!action || supplyActionInFlight.has(action.state) || invalidatedState.current === action.state) return;
		invalidatedState.current = action.state;
		const domains = new Set(action.verified_effects?.affected_domains ?? []);
		if (domains.size === 0) return;
		void queryClient.invalidateQueries({
			predicate: (cached) => {
				const owned = (cached.meta?.affectedDomains as string[] | undefined) ?? [];
				return owned.some((domain) => domains.has(domain));
			},
		});
	}, [query.data, queryClient]);
	return query;
}

export function useMediaSupplyActionEvents(actionID: string | null, live = true) {
	const cursor = useRef({ actionID: '', sequence: 0 });
	const [collected, setCollected] = useState<Awaited<ReturnType<typeof listMediaSupplyActionEvents>>['events']>([]);
	useEffect(() => {
		cursor.current = { actionID: actionID ?? '', sequence: 0 };
		setCollected([]);
	}, [actionID]);
    const query = useQuery({
        queryKey: mediaCirculationKeys.supplyActionEvents(actionID ?? 'none'),
        queryFn: ({ signal }) => listMediaSupplyActionEvents(actionID as string, cursor.current.actionID === actionID ? cursor.current.sequence : 0, signal),
        enabled: Boolean(actionID),
        staleTime: 0,
        gcTime: CACHE_CONFIG.details.gcTime,
		retry: 3,
		retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 8_000),
        refetchInterval: live ? 3_000 : false,
        refetchIntervalInBackground: false,
    });
	useEffect(() => {
		if (!query.data || query.data.id !== actionID || cursor.current.actionID !== actionID || query.data.next_sequence < cursor.current.sequence) return;
		cursor.current.sequence = query.data.next_sequence;
		if (query.data.events.length === 0) return;
		setCollected((current) => {
			const bySequence = new Map(current.map((event) => [event.sequence, event]));
			for (const event of query.data.events) bySequence.set(event.sequence, event);
			return [...bySequence.values()].sort((a, b) => a.sequence - b.sequence).slice(-100);
		});
	}, [query.data, actionID]);
	return { ...query, data: query.data ? { ...query.data, events: collected } : undefined };
}

export function useMediaSupplyQualificationState() {
	return useQuery({
		queryKey: mediaCirculationKeys.supplyQualification(),
		queryFn: getMediaSupplyQualificationState,
		staleTime: 60_000,
		gcTime: CACHE_CONFIG.lists.gcTime,
		retry: 1,
	});
}

export function useCreateMediaSupplyActionPreview() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ key, episodeID, eligibilityID }: { key: string; episodeID: string; eligibilityID: string }) => createMediaSupplyActionPreview(key, episodeID, eligibilityID),
        onSuccess: (_, variables) => queryClient.invalidateQueries({ queryKey: mediaCirculationKeys.supplyEpisodeActions(variables.episodeID) }),
    });
}

export function useConfirmMediaSupplyActionPreview() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (previewID: string) => confirmMediaSupplyActionPreview(previewID),
        onSuccess: (action) => {
			queryClient.setQueryData(mediaCirculationKeys.supplyAction(action.id), action);
            void queryClient.invalidateQueries({ queryKey: [...mediaCirculationKeys.all, 'supply-action-history'] });
			void queryClient.invalidateQueries({ queryKey: mediaCirculationKeys.supplyEpisodes() });
		},
    });
}

export function useCancelMediaSupplyAction() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (actionID: string) => cancelMediaSupplyAction(actionID),
        onSuccess: (action) => {
			queryClient.setQueryData(mediaCirculationKeys.supplyAction(action.id), action);
            void queryClient.invalidateQueries({ queryKey: [...mediaCirculationKeys.all, 'supply-action-history'] });
			void queryClient.invalidateQueries({ queryKey: mediaCirculationKeys.supplyEpisodes() });
		},
    });
}

export function useMediaCirculationOverrides() {
    return useQuery({
        queryKey: mediaCirculationKeys.overrides(),
        queryFn: listMediaCirculationOverrides,
        staleTime: CACHE_CONFIG.lists.staleTime,
        gcTime: CACHE_CONFIG.lists.gcTime,
    });
}

export function useMediaCirculationHealth() {
    return useQuery({
        queryKey: mediaCirculationKeys.health(),
        queryFn: getMediaCirculationHealth,
        staleTime: CACHE_CONFIG.lists.staleTime,
        gcTime: CACHE_CONFIG.lists.gcTime,
        refetchInterval: 60_000,
        refetchIntervalInBackground: false,
    });
}

export function useMediaSourceDiversity() {
    return useQuery({
        queryKey: mediaCirculationKeys.diversity(),
        queryFn: getMediaSourceDiversity,
        staleTime: 30_000,
        gcTime: 120_000,
        refetchInterval: 60_000,
    });
}

export function useMediaCirculationPolicy() {
    return useQuery({
        queryKey: mediaCirculationKeys.policy(),
        queryFn: getMediaCirculationPolicy,
        staleTime: CACHE_CONFIG.details.staleTime,
        gcTime: CACHE_CONFIG.details.gcTime,
    });
}

export function useMediaCirculationRecommendations(unitType: RecommendationUnitType, status: 'pending' | 'all' = 'all') {
    return useQuery({
        queryKey: mediaCirculationKeys.recommendations(unitType, status),
        queryFn: () =>
            listMediaCirculationRecommendations({
                unit_type: unitType,
                status,
            }),
        staleTime: CACHE_CONFIG.lists.staleTime,
        gcTime: CACHE_CONFIG.lists.gcTime,
    });
}

export function useUpdateMediaCirculationPolicy() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: Partial<MediaCirculationPolicy>) => updateMediaCirculationPolicy(data),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: mediaCirculationKeys.all,
            });
            toast({
                title: 'Policy saved',
                description: 'Media circulation policy updated.',
                variant: 'success',
            });
        },
        onError: (err: Error) => {
            toast({
                title: 'Failed to save policy',
                description: err.message,
                variant: 'destructive',
            });
        },
    });
}

export function useGenerateMediaCirculationRecommendations() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: generateMediaCirculationRecommendations,
        onSuccess: (resp) => {
            queryClient.invalidateQueries({
                queryKey: mediaCirculationKeys.all,
            });
            const { item_family, source } = resp.data;
            toast({
                title: 'Recommendations generated',
                description: `${item_family.count} evict · ${source.count} intake`,
                variant: 'success',
            });
        },
        onError: (err: Error) => {
            toast({
                title: 'Generation failed',
                description: err.message,
                variant: 'destructive',
            });
        },
    });
}

export function useApplyRecommendation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => applyMediaCirculationRecommendation(id),
        onSuccess: (resp) => {
            queryClient.invalidateQueries({
                queryKey: mediaCirculationKeys.all,
            });
            toast({
                title: 'Recommendation applied',
                description: `Outcome: ${resp.data.outcome ?? 'applied'}`,
                variant: 'success',
            });
        },
        onError: (err: Error) => {
            toast({
                title: 'Apply failed',
                description: err.message,
                variant: 'destructive',
            });
        },
    });
}

export function useDismissRecommendation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => dismissMediaCirculationRecommendation(id),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: mediaCirculationKeys.all,
            });
            toast({ title: 'Recommendation dismissed', variant: 'success' });
        },
        onError: (err: Error) => {
            toast({
                title: 'Dismiss failed',
                description: err.message,
                variant: 'destructive',
            });
        },
    });
}

export function useRevertRecommendation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => revertMediaCirculationRecommendation(id),
        onSuccess: (resp) => {
            queryClient.invalidateQueries({
                queryKey: mediaCirculationKeys.all,
            });
            toast({
                title: 'Recommendation reverted',
                description: `Outcome: ${resp.data.outcome ?? 'reverted'}`,
                variant: 'success',
            });
        },
        onError: (err: Error) => {
            toast({
                title: 'Revert failed',
                description: err.message,
                variant: 'destructive',
            });
        },
    });
}

export function useCreateMediaCirculationOverride() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: MediaCirculationOverrideRequest) => createMediaCirculationOverride(data),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: mediaCirculationKeys.all,
            });
            toast({ title: 'Override saved', variant: 'success' });
        },
        onError: (err: Error) => {
            toast({
                title: 'Override failed',
                description: err.message,
                variant: 'destructive',
            });
        },
    });
}

export function useDeleteMediaCirculationOverride() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => deleteMediaCirculationOverride(id),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: mediaCirculationKeys.all,
            });
            toast({ title: 'Override removed', variant: 'success' });
        },
        onError: (err: Error) => {
            toast({
                title: 'Remove failed',
                description: err.message,
                variant: 'destructive',
            });
        },
    });
}
