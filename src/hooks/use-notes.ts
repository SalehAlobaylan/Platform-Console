import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listCustomerNotes,
  listDealNotes,
  getNote,
  createNote,
  deleteNote,
} from '@/lib/api/crm/notes';
import type { Note, ListNotesParams, CreateNoteRequest } from '@/types/crm';
import { toast } from '@/components/ui/toast';
import { CACHE_CONFIG } from '@/app/providers';

// Query keys
export const noteKeys = {
  all: ['notes'] as const,
  lists: () => [...noteKeys.all, 'list'] as const,
  customer: (
    customerId: string,
    params?: Pick<ListNotesParams, 'page' | 'limit'>
  ) => [...noteKeys.all, 'customer', customerId, params] as const,
  deal: (dealId: string, params?: Pick<ListNotesParams, 'page' | 'limit'>) =>
    [...noteKeys.all, 'deal', dealId, params] as const,
  detail: (id: string) => [...noteKeys.all, 'detail', id] as const,
};

/**
 * Hook to fetch notes for a customer
 */
export function useCustomerNotes(
  customerId: string,
  params?: Pick<ListNotesParams, 'page' | 'limit'>
) {
  return useQuery({
    queryKey: noteKeys.customer(customerId, params),
    queryFn: () => listCustomerNotes(customerId, params),
    enabled: !!customerId,
    staleTime: CACHE_CONFIG.lists.staleTime,
    gcTime: CACHE_CONFIG.lists.gcTime,
  });
}

/**
 * Hook to fetch notes for a deal
 */
export function useDealNotes(
  dealId: string,
  params?: Pick<ListNotesParams, 'page' | 'limit'>
) {
  return useQuery({
    queryKey: noteKeys.deal(dealId, params),
    queryFn: () => listDealNotes(dealId, params),
    enabled: !!dealId,
    staleTime: CACHE_CONFIG.lists.staleTime,
    gcTime: CACHE_CONFIG.lists.gcTime,
  });
}

/**
 * Hook to fetch a single note by ID
 */
export function useNote(id: string) {
  return useQuery({
    queryKey: noteKeys.detail(id),
    queryFn: () => getNote(id),
    enabled: !!id,
    staleTime: CACHE_CONFIG.details.staleTime,
    gcTime: CACHE_CONFIG.details.gcTime,
  });
}

/**
 * Hook to create a new note
 */
export function useCreateNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateNoteRequest) => createNote(data),
    onSuccess: (_, variables) => {
      // Invalidate the relevant list
      if (variables.customer_id) {
        queryClient.invalidateQueries({
          queryKey: noteKeys.customer(variables.customer_id),
        });
      }
      if (variables.deal_id) {
        queryClient.invalidateQueries({
          queryKey: noteKeys.deal(variables.deal_id),
        });
      }
      toast({
        title: 'Note created',
        description: 'The note has been created successfully.',
        variant: 'success',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to create note',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

/**
 * Hook to delete a note
 */
export function useDeleteNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteNote(id),
    onSuccess: () => {
      // Invalidate all note lists since we don't have the context
      queryClient.invalidateQueries({ queryKey: noteKeys.lists() });
      toast({
        title: 'Note deleted',
        description: 'The note has been deleted.',
        variant: 'success',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to delete note',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
