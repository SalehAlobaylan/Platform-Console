import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    listSources,
    getSource,
    createSource,
    updateSource,
    deleteSource,
    runSource,
} from '@/lib/api/cms/sources';
import type {
    ContentSource,
    ListSourcesParams,
    CreateSourceRequest,
    UpdateSourceRequest,
} from '@/types/platform/source';
import { toast } from '@/components/ui/toast';

// Query keys
export const sourceKeys = {
    all: ['sources'] as const,
    lists: () => [...sourceKeys.all, 'list'] as const,
    list: (params: ListSourcesParams) => [...sourceKeys.lists(), params] as const,
    details: () => [...sourceKeys.all, 'detail'] as const,
    detail: (id: string) => [...sourceKeys.details(), id] as const,
};

/**
 * Hook to fetch paginated list of sources
 */
export function useSources(params: ListSourcesParams = {}) {
    return useQuery({
        queryKey: sourceKeys.list(params),
        queryFn: () => listSources(params),
    });
}

/**
 * Hook to fetch a single source by ID
 */
export function useSource(id: string) {
    return useQuery({
        queryKey: sourceKeys.detail(id),
        queryFn: () => getSource(id),
        enabled: !!id,
    });
}

/**
 * Hook to create a new source
 */
export function useCreateSource() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: CreateSourceRequest) => createSource(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: sourceKeys.lists() });
            toast({
                title: 'Source created',
                description: 'The content source has been created successfully.',
                variant: 'success',
            });
        },
        onError: (error: Error) => {
            toast({
                title: 'Failed to create source',
                description: error.message,
                variant: 'destructive',
            });
        },
    });
}

/**
 * Hook to update an existing source
 */
export function useUpdateSource() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: UpdateSourceRequest }) =>
            updateSource(id, data),
        onSuccess: (updatedSource: ContentSource) => {
            queryClient.invalidateQueries({ queryKey: sourceKeys.lists() });
            queryClient.setQueryData(sourceKeys.detail(updatedSource.id), updatedSource);
            toast({
                title: 'Source updated',
                description: 'The content source has been updated successfully.',
                variant: 'success',
            });
        },
        onError: (error: Error) => {
            toast({
                title: 'Failed to update source',
                description: error.message,
                variant: 'destructive',
            });
        },
    });
}

/**
 * Hook to delete a source
 */
export function useDeleteSource() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => deleteSource(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: sourceKeys.lists() });
            toast({
                title: 'Source deleted',
                description: 'The content source has been deleted.',
                variant: 'success',
            });
        },
        onError: (error: Error) => {
            toast({
                title: 'Failed to delete source',
                description: error.message,
                variant: 'destructive',
            });
        },
    });
}

/**
 * Hook to trigger source ingestion
 */
export function useRunSource() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => runSource(id),
        onSuccess: (response, id) => {
            // Invalidate source detail to show updated last_fetched_at
            queryClient.invalidateQueries({ queryKey: sourceKeys.detail(id) });
            queryClient.invalidateQueries({ queryKey: sourceKeys.lists() });
            toast({
                title: 'Ingestion started',
                description: response.message || 'The source ingestion has been triggered.',
                variant: 'success',
            });
        },
        onError: (error: Error) => {
            toast({
                title: 'Failed to run ingestion',
                description: error.message,
                variant: 'destructive',
            });
        },
    });
}
