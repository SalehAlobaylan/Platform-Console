import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/toast';
import { contentKeys } from '@/hooks/use-content';
import { podsAutomationKey } from '@/hooks/use-pods-automation';
import {
    bulkRequestMediaAcquisition,
    getMediaAcquisitionConfig,
    requestMediaAcquisition,
    updateMediaAcquisitionConfig,
} from '@/lib/api/cms/media-acquisition';
import type { MediaAcquisitionConfigUpdate } from '@/lib/api/cms/media-acquisition';

export const mediaAcquisitionKeys = {
    all: ['media-acquisition'] as const,
    config: ['media-acquisition', 'config'] as const,
};

export function useMediaAcquisitionConfig() {
    return useQuery({
        queryKey: mediaAcquisitionKeys.config,
        queryFn: getMediaAcquisitionConfig,
        staleTime: 30_000,
    });
}

export function useUpdateMediaAcquisitionConfig() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (update: MediaAcquisitionConfigUpdate) => updateMediaAcquisitionConfig(update),
        onSuccess: (config) => {
            queryClient.setQueryData(mediaAcquisitionKeys.config, config);
            queryClient.invalidateQueries({ queryKey: contentKeys.lists() });
            queryClient.invalidateQueries({ queryKey: ['sources'] });
            queryClient.invalidateQueries({ queryKey: podsAutomationKey });
            toast({ title: 'Media acquisition settings saved', variant: 'success' });
        },
        onError: (error: Error) => toast({ title: 'Failed to save acquisition settings', description: error.message, variant: 'destructive' }),
    });
}

export function useRequestMediaAcquisition() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: requestMediaAcquisition,
        onSuccess: (result) => {
            queryClient.invalidateQueries({ queryKey: contentKeys.lists() });
            toast({ title: result.disposition === 'already_active' ? 'Media already active' : 'Download and processing queued', variant: 'success' });
        },
        onError: (error: Error) => toast({ title: 'Media acquisition rejected', description: error.message, variant: 'destructive' }),
    });
}

export function useBulkRequestMediaAcquisition() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: bulkRequestMediaAcquisition,
        onSuccess: (results) => {
            queryClient.invalidateQueries({ queryKey: contentKeys.lists() });
            const failed = results.filter((item) => item.error).length;
            toast({
                title: 'Media acquisition evaluated',
                description: `${results.length - failed} accepted · ${failed} rejected`,
                variant: failed ? 'default' : 'success',
            });
        },
        onError: (error: Error) => toast({ title: 'Bulk acquisition failed', description: error.message, variant: 'destructive' }),
    });
}
