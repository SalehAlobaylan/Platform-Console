import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listContent,
  getContent,
  updateContentStatus,
} from '@/lib/api/cms/content';
import type {
  ContentItem,
  ListContentParams,
  ContentStatus,
} from '@/types/platform/content';
import { toast } from '@/components/ui/toast';
import { CACHE_CONFIG } from '@/app/providers';

// Query keys
export const contentKeys = {
  all: ['content'] as const,
  lists: () => [...contentKeys.all, 'list'] as const,
  list: (params: ListContentParams) =>
    [...contentKeys.lists(), params] as const,
  details: () => [...contentKeys.all, 'detail'] as const,
  detail: (id: string) => [...contentKeys.details(), id] as const,
};

/**
 * Hook to fetch paginated list of content
 */
export function useContent(params: ListContentParams = {}) {
  return useQuery({
    queryKey: contentKeys.list(params),
    queryFn: () => listContent(params),
    staleTime: CACHE_CONFIG.lists.staleTime,
    gcTime: CACHE_CONFIG.lists.gcTime,
  });
}

/**
 * Hook to fetch a single content item by ID
 */
export function useContentItem(id: string) {
  return useQuery({
    queryKey: contentKeys.detail(id),
    queryFn: () => getContent(id),
    enabled: !!id,
    staleTime: CACHE_CONFIG.details.staleTime,
    gcTime: CACHE_CONFIG.details.gcTime,
  });
}

/**
 * Hook to update content status (e.g., archive)
 */
export function useUpdateContentStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: ContentStatus }) =>
      updateContentStatus(id, { status }),
    onSuccess: (updatedItem: ContentItem) => {
      queryClient.invalidateQueries({ queryKey: contentKeys.lists() });
      queryClient.setQueryData(contentKeys.detail(updatedItem.id), updatedItem);
      toast({
        title: 'Status updated',
        description: `Content status changed to ${updatedItem.status}.`,
        variant: 'success',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to update status',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
