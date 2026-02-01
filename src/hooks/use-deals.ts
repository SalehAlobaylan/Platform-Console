import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listDeals,
  getDeal,
  createDeal,
  updateDeal,
  deleteDeal,
  updateDealStage,
} from '@/lib/api/crm/deals';
import type {
  Deal,
  ListDealsParams,
  CreateDealRequest,
  UpdateDealRequest,
  DealStage,
} from '@/types/crm';
import { toast } from '@/components/ui/toast';
import { CACHE_CONFIG } from '@/app/providers';

// Query keys
export const dealKeys = {
  all: ['deals'] as const,
  lists: () => [...dealKeys.all, 'list'] as const,
  list: (params: ListDealsParams) => [...dealKeys.lists(), params] as const,
  details: () => [...dealKeys.all, 'detail'] as const,
  detail: (id: string) => [...dealKeys.details(), id] as const,
};

/**
 * Hook to fetch paginated list of deals
 */
export function useDeals(params: ListDealsParams = {}) {
  return useQuery({
    queryKey: dealKeys.list(params),
    queryFn: () => listDeals(params),
    staleTime: CACHE_CONFIG.lists.staleTime,
    gcTime: CACHE_CONFIG.lists.gcTime,
  });
}

/**
 * Hook to fetch a single deal by ID
 */
export function useDeal(id: string) {
  return useQuery({
    queryKey: dealKeys.detail(id),
    queryFn: () => getDeal(id),
    enabled: !!id,
    staleTime: CACHE_CONFIG.details.staleTime,
    gcTime: CACHE_CONFIG.details.gcTime,
  });
}

/**
 * Hook to create a new deal
 */
export function useCreateDeal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateDealRequest) => createDeal(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dealKeys.lists() });
      toast({
        title: 'Deal created',
        description: 'The deal has been created successfully.',
        variant: 'success',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to create deal',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

/**
 * Hook to update an existing deal
 */
export function useUpdateDeal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateDealRequest }) =>
      updateDeal(id, data),
    onSuccess: (updatedDeal: Deal) => {
      queryClient.invalidateQueries({ queryKey: dealKeys.lists() });
      queryClient.setQueryData(dealKeys.detail(updatedDeal.id), updatedDeal);
      toast({
        title: 'Deal updated',
        description: 'The deal has been updated successfully.',
        variant: 'success',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to update deal',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

/**
 * Hook to delete a deal
 */
export function useDeleteDeal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteDeal(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dealKeys.lists() });
      toast({
        title: 'Deal deleted',
        description: 'The deal has been deleted.',
        variant: 'success',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to delete deal',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

/**
 * Hook to update deal stage
 */
export function useUpdateDealStage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: DealStage }) =>
      updateDealStage(id, { stage }),
    onSuccess: (updatedDeal: Deal) => {
      queryClient.invalidateQueries({ queryKey: dealKeys.lists() });
      queryClient.setQueryData(dealKeys.detail(updatedDeal.id), updatedDeal);
      toast({
        title: 'Deal stage updated',
        description: `Deal moved to ${updatedDeal.stage}.`,
        variant: 'success',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to update deal stage',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
