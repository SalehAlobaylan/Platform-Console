import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/toast';
import {
    approveRetentionAction,
    executeRetentionAction,
    executeHistoricalRetention,
    prepareHistoricalRetention,
    createRetentionMaintenanceReport,
    listRetentionOwnerRequests,
    getRetentionStatus,
    getRetentionRun,
    getRetentionActionReview,
    listRetentionHolds,
    listRetentionRunActions,
    listRetentionRuns,
    pauseRetention,
    prepareRetentionCompaction,
    runRetention,
    updateRetentionPolicy,
    updateRetentionExecutionControl,
    getMonthlyReviewPolicy,
    listMonthlyReviewArchives,
    buildMonthlyReview,
    updateMonthlyReviewPolicy,
    verifyMonthlyReview,
} from '@/lib/api/cms/retention';
import type { RetentionPolicyPatch, RetentionStatus } from '@/types/platform/retention';

export const retentionKeys = {
    all: ['retention'] as const,
    status: () => [...retentionKeys.all, 'status'] as const,
    runs: () => [...retentionKeys.all, 'runs'] as const,
    actions: (runId?: string) => [...retentionKeys.all, 'actions', runId] as const,
    run: (id?: string) => [...retentionKeys.all, 'run', id] as const,
    review: (id?: string) => [...retentionKeys.all, 'review', id] as const,
    holds: () => [...retentionKeys.all, 'holds'] as const,
    monthlyPolicy: () => [...retentionKeys.all, 'monthly-policy'] as const,
    monthlyArchives: () => [...retentionKeys.all, 'monthly-archives'] as const,
    ownerRequests: () => [...retentionKeys.all, 'owner-requests'] as const,
};

export function useRetentionStatus() {
    return useQuery({
        queryKey: retentionKeys.status(),
        queryFn: getRetentionStatus,
        staleTime: 15_000,
        refetchInterval: 30_000,
    });
}

export function useRetentionRuns() {
    return useQuery({ queryKey: retentionKeys.runs(), queryFn: listRetentionRuns, staleTime: 15_000 });
}

export function useRetentionRunActions(runId?: string) {
    return useQuery({
        queryKey: retentionKeys.actions(runId),
        queryFn: () => listRetentionRunActions(runId!),
        enabled: Boolean(runId),
        staleTime: 15_000,
    });
}

export function useRetentionHolds() {
    return useQuery({ queryKey: retentionKeys.holds(), queryFn: listRetentionHolds, staleTime: 15_000 });
}
export function useRetentionOwnerRequests() { return useQuery({ queryKey: retentionKeys.ownerRequests(), queryFn: listRetentionOwnerRequests, staleTime: 15_000 }); }

export function useMonthlyReviewPolicy() { return useQuery({ queryKey: retentionKeys.monthlyPolicy(), queryFn: getMonthlyReviewPolicy, staleTime: 30_000 }); }
export function useMonthlyReviewArchives() { return useQuery({ queryKey: retentionKeys.monthlyArchives(), queryFn: listMonthlyReviewArchives, staleTime: 30_000 }); }
export function useBuildMonthlyReview() {
    const queryClient = useQueryClient();
    return useMutation({ mutationFn: buildMonthlyReview, onSuccess: (archive) => { invalidateRetention(queryClient); toast({ title: 'Month in Review verified', description: `${archive.selected_count} stories published in revision ${archive.revision}.`, variant: 'success' }); }, onError: (error: Error) => toast({ title: 'Month in Review was not built', description: error.message, variant: 'destructive' }) });
}
export function useVerifyMonthlyReview() {
    const queryClient = useQueryClient();
    return useMutation({ mutationFn: verifyMonthlyReview, onSuccess: (archive) => { invalidateRetention(queryClient); toast({ title: 'Month in Review published', description: `Revision ${archive.revision} passed archive readback.`, variant: 'success' }); }, onError: (error: Error) => toast({ title: 'Archive verification failed', description: error.message, variant: 'destructive' }) });
}
export function useUpdateMonthlyReviewPolicy() {
    const queryClient = useQueryClient();
    return useMutation({ mutationFn: ({ config, reason }: { config: Parameters<typeof updateMonthlyReviewPolicy>[0]; reason: string }) => updateMonthlyReviewPolicy(config, reason), onSuccess: () => { invalidateRetention(queryClient); toast({ title: 'New monthly-review policy revision activated', variant: 'success' }); }, onError: (error: Error) => toast({ title: 'Policy revision was not created', description: error.message, variant: 'destructive' }) });
}

function invalidateRetention(queryClient: ReturnType<typeof useQueryClient>) {
    return queryClient.invalidateQueries({ queryKey: retentionKeys.all });
}

export function useUpdateRetentionPolicy() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (patch: RetentionPolicyPatch) => updateRetentionPolicy(patch),
        onSuccess: (policy) => {
            queryClient.setQueryData<RetentionStatus>(retentionKeys.status(), (status) => status ? { ...status, policy } : status);
            invalidateRetention(queryClient);
            toast({ title: 'Retention policy saved', variant: 'success' });
        },
        onError: (error: Error) =>
            toast({ title: 'Policy was not saved', description: error.message, variant: 'destructive' }),
    });
}

export function useUpdateRetentionExecutionControl() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: updateRetentionExecutionControl,
        onSuccess: (execution_controls) => {
            queryClient.setQueryData<RetentionStatus>(retentionKeys.status(), (status) => status ? { ...status, execution_controls } : status);
            invalidateRetention(queryClient);
            toast({ title: 'Retention execution control saved', variant: 'success' });
        },
        onError: (error: Error) => toast({ title: 'Execution control was not saved', description: error.message, variant: 'destructive' }),
    });
}

export function useRunRetention() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: runRetention,
        onSuccess: (run) => {
            invalidateRetention(queryClient);
            toast({ title: 'Retention observation complete', description: `Verdict: ${run.verdict}`, variant: 'success' });
        },
        onError: (error: Error) =>
            toast({ title: 'Retention run failed', description: error.message, variant: 'destructive' }),
    });
}

export function usePrepareRetentionCompaction() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: prepareRetentionCompaction,
        onSuccess: (manifest) => {
            invalidateRetention(queryClient);
            toast({
                title: 'Compaction manifest prepared',
                description: `${manifest.retire_count} rows await a later approved executor.`,
                variant: 'success',
            });
        },
        onError: (error: Error) =>
            toast({ title: 'Manifest was not prepared', description: error.message, variant: 'destructive' }),
    });
}

export function usePrepareHistoricalRetention() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: prepareHistoricalRetention,
        onSuccess: (manifest) => { invalidateRetention(queryClient); toast({ title: 'Historical manifest prepared', description: `${manifest.content_count} old News rows await approval.`, variant: 'success' }); },
        onError: (error: Error) => toast({ title: 'Historical manifest was not prepared', description: error.message, variant: 'destructive' }),
    });
}

export function useExecuteHistoricalRetention() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: executeHistoricalRetention,
        onSuccess: (action) => { invalidateRetention(queryClient); toast({ title: 'Historical retirement verified', description: `${action.target_count} exact rows were retired after recovery and feed checks.`, variant: 'success' }); },
        onError: (error: Error) => { invalidateRetention(queryClient); toast({ title: 'Historical retirement needs attention', description: error.message, variant: 'destructive' }); },
    });
}

export function useRetentionMaintenanceReport() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: createRetentionMaintenanceReport,
        onSuccess: (report) => { invalidateRetention(queryClient); toast({ title: report.state === 'free_downgrade_ready' ? 'Free downgrade readiness confirmed' : 'Maintenance readiness measured', description: `${Math.round(report.database_bytes / (1024 * 1024))} MiB measured.`, variant: report.state === 'free_downgrade_ready' ? 'success' : 'default' }); },
        onError: (error: Error) => toast({ title: 'Maintenance report failed', description: error.message, variant: 'destructive' }),
    });
}

export function useApproveRetentionAction() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: approveRetentionAction,
        onSuccess: () => {
            invalidateRetention(queryClient);
            toast({ title: 'Compaction approved', description: 'A separate execution step is still required.', variant: 'success' });
        },
        onError: (error: Error) =>
            toast({ title: 'Approval failed', description: error.message, variant: 'destructive' }),
    });
}

export function useExecuteRetentionAction() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: executeRetentionAction,
        onSuccess: (action) => {
            invalidateRetention(queryClient);
            toast({ title: 'Compaction verified', description: `${action.target_count} selected rows were compacted.`, variant: 'success' });
        },
        onError: (error: Error) => { invalidateRetention(queryClient); toast({ title: 'Compaction needs attention', description: error.message, variant: 'destructive' }); },
    });
}

export function usePauseRetention() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: pauseRetention,
        onSuccess: () => {
            invalidateRetention(queryClient);
            toast({ title: 'Retention schedule paused', variant: 'success' });
        },
    });
}

export function useRetentionRun(id?: string) {
    return useQuery({ queryKey: retentionKeys.run(id), queryFn: () => getRetentionRun(id!), enabled: Boolean(id), retry: false });
}
export function useRetentionActionReview(id?: string) {
    return useQuery({ queryKey: retentionKeys.review(id), queryFn: () => getRetentionActionReview(id!), enabled: Boolean(id), retry: false });
}
