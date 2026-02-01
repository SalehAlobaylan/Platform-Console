import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listTags,
  getTag,
  createTag,
  updateTag,
  deleteTag,
} from '@/lib/api/crm/tags';
import type { Tag, CreateTagRequest, UpdateTagRequest } from '@/types/crm';
import { toast } from '@/components/ui/toast';
import { CACHE_CONFIG } from '@/app/providers';

// Query keys
export const tagKeys = {
  all: ['tags'] as const,
  lists: () => [...tagKeys.all, 'list'] as const,
  detail: (id: string) => [...tagKeys.all, 'detail', id] as const,
};

/**
 * Hook to fetch all tags
 */
export function useTags() {
  return useQuery({
    queryKey: tagKeys.lists(),
    queryFn: () => listTags(),
    staleTime: CACHE_CONFIG.reference.staleTime,
    gcTime: CACHE_CONFIG.reference.gcTime,
  });
}

/**
 * Hook to fetch a single tag by ID
 */
export function useTag(id: string) {
  return useQuery({
    queryKey: tagKeys.detail(id),
    queryFn: () => getTag(id),
    enabled: !!id,
    staleTime: CACHE_CONFIG.reference.staleTime,
    gcTime: CACHE_CONFIG.reference.gcTime,
  });
}

/**
 * Hook to create a new tag
 */
export function useCreateTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateTagRequest) => createTag(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tagKeys.lists() });
      toast({
        title: 'Tag created',
        description: 'The tag has been created successfully.',
        variant: 'success',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to create tag',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

/**
 * Hook to update an existing tag
 */
export function useUpdateTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTagRequest }) =>
      updateTag(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tagKeys.lists() });
      toast({
        title: 'Tag updated',
        description: 'The tag has been updated successfully.',
        variant: 'success',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to update tag',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

/**
 * Hook to delete a tag
 */
export function useDeleteTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteTag(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tagKeys.lists() });
      toast({
        title: 'Tag deleted',
        description: 'The tag has been deleted.',
        variant: 'success',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to delete tag',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
