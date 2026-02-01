import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listActivities,
  listMyActivities,
  getActivity,
  createActivity,
  updateActivity,
  deleteActivity,
  completeActivity,
} from '@/lib/api/crm/activities';
import type {
  Activity,
  ListActivitiesParams,
  CreateActivityRequest,
  UpdateActivityRequest,
} from '@/types/crm';
import { toast } from '@/components/ui/toast';
import { CACHE_CONFIG } from '@/app/providers';

// Query keys
export const activityKeys = {
  all: ['activities'] as const,
  lists: () => [...activityKeys.all, 'list'] as const,
  list: (params: ListActivitiesParams) =>
    [...activityKeys.lists(), params] as const,
  details: () => [...activityKeys.all, 'detail'] as const,
  detail: (id: string) => [...activityKeys.details(), id] as const,
  my: (params?: Omit<ListActivitiesParams, 'owner_id'>) =>
    [...activityKeys.all, 'my', params] as const,
};

/**
 * Hook to fetch paginated list of all activities
 */
export function useActivities(params: ListActivitiesParams = {}) {
  return useQuery({
    queryKey: activityKeys.list(params),
    queryFn: () => listActivities(params),
    staleTime: CACHE_CONFIG.lists.staleTime,
    gcTime: CACHE_CONFIG.lists.gcTime,
  });
}

/**
 * Hook to fetch paginated list of current user's activities
 */
export function useMyActivities(
  params?: Omit<ListActivitiesParams, 'owner_id'>
) {
  return useQuery({
    queryKey: activityKeys.my(params),
    queryFn: () => listMyActivities(params || {}),
    staleTime: CACHE_CONFIG.lists.staleTime,
    gcTime: CACHE_CONFIG.lists.gcTime,
  });
}

/**
 * Hook to fetch a single activity by ID
 */
export function useActivity(id: string) {
  return useQuery({
    queryKey: activityKeys.detail(id),
    queryFn: () => getActivity(id),
    enabled: !!id,
    staleTime: CACHE_CONFIG.details.staleTime,
    gcTime: CACHE_CONFIG.details.gcTime,
  });
}

/**
 * Hook to create a new activity
 */
export function useCreateActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateActivityRequest) => createActivity(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: activityKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: activityKeys.my as unknown as string[],
      });
      toast({
        title: 'Activity created',
        description: 'The activity has been created successfully.',
        variant: 'success',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to create activity',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

/**
 * Hook to update an existing activity
 */
export function useUpdateActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateActivityRequest }) =>
      updateActivity(id, data),
    onSuccess: (updatedActivity: Activity) => {
      queryClient.invalidateQueries({ queryKey: activityKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: activityKeys.my as unknown as string[],
      });
      queryClient.setQueryData(
        activityKeys.detail(updatedActivity.id),
        updatedActivity
      );
      toast({
        title: 'Activity updated',
        description: 'The activity has been updated successfully.',
        variant: 'success',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to update activity',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

/**
 * Hook to delete an activity
 */
export function useDeleteActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteActivity(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: activityKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: activityKeys.my as unknown as string[],
      });
      toast({
        title: 'Activity deleted',
        description: 'The activity has been deleted.',
        variant: 'success',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to delete activity',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

/**
 * Hook to mark an activity as complete
 */
export function useCompleteActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => completeActivity(id),
    onSuccess: (updatedActivity: Activity) => {
      queryClient.invalidateQueries({ queryKey: activityKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: activityKeys.my as unknown as string[],
      });
      queryClient.setQueryData(
        activityKeys.detail(updatedActivity.id),
        updatedActivity
      );
      toast({
        title: 'Activity completed',
        description: 'The activity has been marked as complete.',
        variant: 'success',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to complete activity',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
