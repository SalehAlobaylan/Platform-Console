'use client';

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { z } from 'zod';

import { cmsClient } from '@/lib/api/client';
import {
  operatorBriefingSchema,
  operatorControlsSchema,
  operatorEligibleActionsSchema,
  operatorEventResponseSchema,
  operatorEvidenceListSchema,
  operatorInvestigationStartSchema,
  operatorPlanEventResponseSchema,
  operatorPlanSchema,
  operatorRecommendationListSchema,
  operatorStatusSchema,
  operatorTaskListSchema,
  operatorThreadDetailSchema,
  operatorThreadListSchema,
  operatorThreadSchema,
} from '@/lib/operator/schemas';
import type {
  OperatorIntent,
  OperatorVisibleContext,
} from '@/types/platform/operator';

const operatorTabSummariesSchema = operatorThreadListSchema.refine(
  (result) =>
    result.items.every(
      (item) =>
        item.activity_state !== undefined &&
        item.active_investigation_count !== undefined
    ),
  'Open chat activity is unavailable'
);

export type OperatorThread = z.infer<typeof operatorThreadSchema>;
export type OperatorThreadDetail = z.infer<typeof operatorThreadDetailSchema>;
export type OperatorTask = z.infer<
  typeof operatorTaskListSchema
>['items'][number];
export type OperatorPlan = z.infer<typeof operatorPlanSchema>;
export type OperatorAction = z.infer<
  typeof operatorEligibleActionsSchema
>['items'][number];

export type OperatorTaskKind =
  | 'all'
  | 'investigation'
  | 'plan'
  | 'schedule'
  | 'schedule_run';
export type OperatorTaskGroup =
  | 'all'
  | 'active'
  | 'needs_approval'
  | 'failed'
  | 'completed';

export const operatorKeys = {
  all: ['operator'] as const,
  status: () => [...operatorKeys.all, 'status'] as const,
  controls: () => [...operatorKeys.all, 'controls'] as const,
  briefing: (context: OperatorVisibleContext, locale: string) =>
    [
      ...operatorKeys.all,
      'briefing',
      context.domain,
      context.view,
      context.subjects,
      context.filters,
      context.selection,
      locale,
    ] as const,
  threads: (filters: object) =>
    [...operatorKeys.all, 'threads', filters] as const,
  thread: (id?: string) => [...operatorKeys.all, 'thread', id] as const,
  tasks: (filters: object) => [...operatorKeys.all, 'tasks', filters] as const,
  evidence: (id?: string) => [...operatorKeys.all, 'evidence', id] as const,
  actions: (id?: string) => [...operatorKeys.all, 'actions', id] as const,
  recommendations: (id?: string) =>
    [...operatorKeys.all, 'recommendations', id] as const,
  investigationEvents: (id?: string) =>
    [...operatorKeys.all, 'investigation-events', id] as const,
  plan: (id?: string) => [...operatorKeys.all, 'plan', id] as const,
  planEvents: (id?: string) =>
    [...operatorKeys.all, 'plan-events', id] as const,
};

const terminalInvestigations = new Set(['completed', 'failed', 'cancelled']);
const terminalPlans = new Set(['succeeded', 'failed', 'blocked', 'cancelled']);

export function useOperatorStatus() {
  return useQuery({
    queryKey: operatorKeys.status(),
    queryFn: async () =>
      operatorStatusSchema.parse(
        await cmsClient.get<unknown>('/admin/operator/status')
      ),
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });
}

export function useOperatorControls(enabled = true) {
  return useQuery({
    queryKey: operatorKeys.controls(),
    enabled,
    queryFn: async () =>
      operatorControlsSchema.parse(
        await cmsClient.get<unknown>('/admin/operator/controls')
      ),
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });
}

export function useOperatorBriefing(
  context: OperatorVisibleContext,
  locale: 'en' | 'ar',
  enabled = true
) {
  return useQuery({
    queryKey: operatorKeys.briefing(context, locale),
    enabled,
    queryFn: async () =>
      operatorBriefingSchema.parse(
        await cmsClient.post<unknown>('/admin/operator/briefings', {
          visible_context: context,
          locale,
        })
      ),
    staleTime: 30_000,
  });
}

export function useOperatorThreads(
  filters: { archived: boolean; pinned?: boolean; q?: string; cursor?: string },
  enabled = true
) {
  const query = useInfiniteQuery({
    queryKey: [...operatorKeys.threads(filters), 'pages'],
    enabled,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ signal, pageParam }) =>
      operatorThreadListSchema.parse(
        await cmsClient.get<unknown>(
          '/admin/operator/threads',
          {
            archived: filters.archived,
            ...(filters.pinned ? { pinned: true } : {}),
            ...(filters.q ? { q: filters.q } : {}),
            ...(pageParam ? { cursor: pageParam } : {}),
            limit: 50,
          },
          signal
        )
      ),
    getNextPageParam: (page) => page.next_cursor || undefined,
  });
  return {
    ...query,
    data: query.data
      ? {
          items: [
            ...new Map(
              query.data.pages
                .flatMap((page) => page.items)
                .map((item) => [item.id, item])
            ).values(),
          ],
          next_cursor: query.data.pages.at(-1)?.next_cursor ?? '',
        }
      : undefined,
  };
}

export function useOperatorThread(id?: string, focus?: string) {
  const query = useInfiniteQuery({
    queryKey: [...operatorKeys.thread(id), 'history', focus],
    enabled: Boolean(id),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ signal, pageParam }) =>
      operatorThreadDetailSchema.parse(
        await cmsClient.get<unknown>(
          `/admin/operator/threads/${id}`,
          pageParam ? { before: pageParam } : focus ? { focus } : undefined,
          signal
        )
      ),
    getNextPageParam: (page) => page.older_cursor || undefined,
    refetchOnWindowFocus: true,
  });
  return {
    ...query,
    data: query.data
      ? {
          thread: query.data.pages[0].thread,
          messages: [
            ...new Map(
              [...query.data.pages]
                .reverse()
                .flatMap((page) => page.messages)
                .map((item) => [item.id, item])
            ).values(),
          ].sort(
            (a, b) =>
              Date.parse(a.created_at) - Date.parse(b.created_at) ||
              a.id.localeCompare(b.id)
          ),
        }
      : undefined,
  };
}

export function useOperatorTabSummaries(ids: string[]) {
  const selected = [...new Set(ids)].sort();
  return useQuery({
    queryKey: ['operator', 'tab-summaries', selected],
    enabled: selected.length > 0,
    queryFn: async ({ signal }) =>
      operatorTabSummariesSchema.parse(
        await cmsClient.get<unknown>(
          '/admin/operator/threads',
          { ids: selected.join(',') },
          signal
        )
      ),
    staleTime: 5_000,
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}

export function useOperatorTasks(
  filters: {
    group: OperatorTaskGroup;
    kind: OperatorTaskKind;
    threadID?: string;
    cursor?: string;
  },
  enabled = true
) {
  const query = useInfiniteQuery({
    queryKey: [...operatorKeys.tasks(filters), 'pages'],
    enabled,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ signal, pageParam }) =>
      operatorTaskListSchema.parse(
        await cmsClient.get<unknown>(
          '/admin/operator/tasks',
          {
            group: filters.group,
            kind: filters.kind,
            ...(filters.threadID ? { thread_id: filters.threadID } : {}),
            ...(pageParam ? { cursor: pageParam } : {}),
            limit: 50,
          },
          signal
        )
      ),
    getNextPageParam: (page) => page.next_cursor || undefined,
    refetchInterval:
      enabled &&
      (filters.group === 'all' ||
        filters.group === 'active' ||
        filters.group === 'needs_approval')
        ? 10_000
        : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
  return {
    ...query,
    data: query.data
      ? {
          items: [
            ...new Map(
              query.data.pages
                .flatMap((page) => page.items)
                .map((item) => [item.id, item])
            ).values(),
          ],
          next_cursor: query.data.pages.at(-1)?.next_cursor ?? '',
        }
      : undefined,
  };
}

export function useOperatorEvidence(investigationID?: string, enabled = true) {
  return useQuery({
    queryKey: operatorKeys.evidence(investigationID),
    enabled: Boolean(investigationID && enabled),
    queryFn: async ({ signal }) =>
      operatorEvidenceListSchema.parse(
        await cmsClient.get<unknown>(
          `/admin/operator/investigations/${investigationID}/evidence`,
          undefined,
          signal
        )
      ),
  });
}

export function useOperatorEligibleActions(
  investigationID?: string,
  completed = false
) {
  return useQuery({
    queryKey: operatorKeys.actions(investigationID),
    enabled: Boolean(investigationID && completed),
    queryFn: async ({ signal }) =>
      operatorEligibleActionsSchema.parse(
        await cmsClient.get<unknown>(
          `/admin/operator/investigations/${investigationID}/eligible-actions`,
          undefined,
          signal
        )
      ),
  });
}

export function useOperatorRecommendations(
  investigationID?: string,
  completed = false
) {
  return useQuery({
    queryKey: operatorKeys.recommendations(investigationID),
    enabled: Boolean(investigationID && completed),
    queryFn: async ({ signal }) =>
      operatorRecommendationListSchema.parse(
        await cmsClient.get<unknown>(
          '/admin/operator/recommendations',
          { investigation_id: investigationID },
          signal
        )
      ),
  });
}

export function useOperatorInvestigationEvents(investigationID?: string) {
  const queryClient = useQueryClient();
  const key = operatorKeys.investigationEvents(investigationID);
  return useQuery({
    queryKey: key,
    enabled: Boolean(investigationID),
    queryFn: async ({ signal }) => {
      const previous =
        queryClient.getQueryData<z.infer<typeof operatorEventResponseSchema>>(
          key
        );
      const response = operatorEventResponseSchema.parse(
        await cmsClient.get<unknown>(
          `/admin/operator/investigations/${investigationID}/events`,
          { after: previous?.next_sequence ?? 0 },
          signal
        )
      );
      return previous && response.events.length
        ? {
            ...response,
            events: [...previous.events, ...response.events].slice(-500),
          }
        : response.events.length
          ? response
          : previous
            ? {
                ...previous,
                state: response.state,
                next_sequence: response.next_sequence,
              }
            : response;
    },
    refetchInterval: (query) =>
      terminalInvestigations.has(query.state.data?.state ?? '') ? false : 1400,
    refetchOnWindowFocus: true,
  });
}

export function useOperatorPlan(planID?: string) {
  return useQuery({
    queryKey: operatorKeys.plan(planID),
    enabled: Boolean(planID),
    queryFn: async ({ signal }) =>
      operatorPlanSchema.parse(
        await cmsClient.get<unknown>(
          `/admin/operator/plans/${planID}`,
          undefined,
          signal
        )
      ),
    refetchOnWindowFocus: true,
  });
}

export function useOperatorPlanEvents(planID?: string) {
  const queryClient = useQueryClient();
  const key = operatorKeys.planEvents(planID);
  return useQuery({
    queryKey: key,
    enabled: Boolean(planID),
    queryFn: async ({ signal }) => {
      const previous =
        queryClient.getQueryData<
          z.infer<typeof operatorPlanEventResponseSchema>
        >(key);
      const response = operatorPlanEventResponseSchema.parse(
        await cmsClient.get<unknown>(
          `/admin/operator/plans/${planID}/events`,
          { after: previous?.next_sequence ?? 0 },
          signal
        )
      );
      return previous && response.events.length
        ? {
            ...response,
            events: [...previous.events, ...response.events].slice(-500),
          }
        : response.events.length
          ? response
          : previous
            ? {
                ...previous,
                state: response.state,
                next_sequence: response.next_sequence,
              }
            : response;
    },
    refetchInterval: (query) =>
      terminalPlans.has(query.state.data?.state ?? '') ? false : 1400,
    refetchOnWindowFocus: true,
  });
}

export function useOperatorMutations() {
  const queryClient = useQueryClient();
  const refreshWorkspace = async () =>
    queryClient.invalidateQueries({ queryKey: operatorKeys.all });
  const refreshConversations = () => {
    // Show an accepted question immediately. Refreshing case indexes must not
    // wait for, or restart, an unrelated operational briefing collection.
    void Promise.all(
      ['threads', 'thread', 'tasks', 'tab-summaries'].map((name) =>
        queryClient.invalidateQueries({ queryKey: [...operatorKeys.all, name] })
      )
    );
  };
  return {
    markInvestigationRead: useMutation({
      mutationFn: async (id: string) =>
        cmsClient.post(`/admin/operator/investigations/${id}/read`),
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: ['operator', 'tab-summaries'],
        });
        void queryClient.invalidateQueries({
          queryKey: ['operator', 'inbox-summary'],
        });
      },
    }),
    createThread: useMutation({
      mutationFn: async (input: { title: string; locale: 'en' | 'ar' }) =>
        operatorThreadSchema.parse(
          await cmsClient.post<unknown>('/admin/operator/threads', input)
        ),
      onSuccess: refreshConversations,
    }),
    patchThread: useMutation({
      mutationFn: async ({
        id,
        ...input
      }: {
        id: string;
        title?: string;
        locale?: 'en' | 'ar';
        pinned?: boolean;
        archived?: boolean;
      }) =>
        operatorThreadSchema.parse(
          await cmsClient.patch<unknown>(`/admin/operator/threads/${id}`, input)
        ),
      onSuccess: refreshWorkspace,
    }),
    deleteThread: useMutation({
      mutationFn: async (id: string) =>
        cmsClient.delete(`/admin/operator/threads/${id}`),
      onSuccess: refreshWorkspace,
    }),
    startInvestigation: useMutation({
      mutationFn: async (input: {
        visible_context: OperatorVisibleContext;
        intent: OperatorIntent;
        locale: 'en' | 'ar';
        message: string;
        tier: 'fast' | 'reasoning';
        thread_id: string;
        spend_acknowledged?: boolean;
      }) =>
        operatorInvestigationStartSchema.parse(
          await cmsClient.post<unknown>('/admin/operator/investigations', input)
        ),
      onSuccess: refreshConversations,
    }),
    cancelInvestigation: useMutation({
      mutationFn: async (id: string) =>
        cmsClient.post(`/admin/operator/investigations/${id}/cancel`),
      onSuccess: refreshWorkspace,
    }),
    createPlan: useMutation({
      mutationFn: async (input: {
        investigation_id: string;
        tool_key: string;
        target_ids: string[];
      }) =>
        operatorPlanSchema.parse(
          await cmsClient.post<unknown>('/admin/operator/plans', input)
        ),
      onSuccess: refreshWorkspace,
    }),
    approvePlan: useMutation({
      mutationFn: async ({
        id,
        confirmation,
      }: {
        id: string;
        confirmation: string;
      }) =>
        operatorPlanSchema.parse(
          await cmsClient.post<unknown>(`/admin/operator/plans/${id}/approve`, {
            confirmation,
          })
        ),
      onSuccess: refreshWorkspace,
    }),
    cancelPlan: useMutation({
      mutationFn: async (id: string) =>
        operatorPlanSchema.parse(
          await cmsClient.post<unknown>(`/admin/operator/plans/${id}/cancel`)
        ),
      onSuccess: refreshWorkspace,
    }),
    invalidateAffectedDomains: async (domains: string[]) =>
      queryClient.invalidateQueries({
        predicate: (query) =>
          domains.some((domain) =>
            query.queryKey.some(
              (part) => typeof part === 'string' && part.includes(domain)
            )
          ),
      }),
  };
}
