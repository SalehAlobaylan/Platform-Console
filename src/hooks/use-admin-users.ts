import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listAdminUsers,
  getAdminUser,
  createAdminUser,
  updateAdminUser,
  deleteAdminUser,
  resetAdminUserPassword,
} from '@/lib/api/cms/admin-users';
import type {
  AdminUser,
  ListAdminUsersParams,
  CreateAdminUserRequest,
  UpdateAdminUserRequest,
  ResetAdminUserPasswordRequest,
} from '@/lib/api/cms/types';
import { toast } from '@/components/ui/toast';
import { CACHE_CONFIG } from '@/app/providers';

export const adminUserKeys = {
  all: ['admin-users'] as const,
  lists: () => [...adminUserKeys.all, 'list'] as const,
  list: (params: ListAdminUsersParams) => [...adminUserKeys.lists(), params] as const,
  details: () => [...adminUserKeys.all, 'detail'] as const,
  detail: (id: string) => [...adminUserKeys.details(), id] as const,
};

export function useAdminUsers(
  params: ListAdminUsersParams & { enabled?: boolean } = {}
) {
  const { enabled, ...queryParams } = params;

  return useQuery({
    queryKey: adminUserKeys.list(queryParams),
    queryFn: () => listAdminUsers(queryParams),
    staleTime: CACHE_CONFIG.lists.staleTime,
    gcTime: CACHE_CONFIG.lists.gcTime,
    enabled,
  });
}

export function useAdminUser(id: string) {
  return useQuery({
    queryKey: adminUserKeys.detail(id),
    queryFn: () => getAdminUser(id),
    enabled: !!id,
    staleTime: CACHE_CONFIG.details.staleTime,
    gcTime: CACHE_CONFIG.details.gcTime,
  });
}

export function useCreateAdminUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateAdminUserRequest) => createAdminUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminUserKeys.lists() });
      toast({
        title: 'Admin user created',
        description: 'The admin user has been created successfully.',
        variant: 'success',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to create admin user',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateAdminUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateAdminUserRequest }) =>
      updateAdminUser(id, data),
    onSuccess: (updated: AdminUser) => {
      queryClient.invalidateQueries({ queryKey: adminUserKeys.lists() });
      queryClient.setQueryData(adminUserKeys.detail(updated.id), updated);
      toast({
        title: 'Admin user updated',
        description: 'The admin user has been updated successfully.',
        variant: 'success',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to update admin user',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteAdminUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteAdminUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminUserKeys.lists() });
      toast({
        title: 'Admin user deleted',
        description: 'The admin user has been deleted.',
        variant: 'success',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to delete admin user',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useResetAdminUserPassword() {
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ResetAdminUserPasswordRequest }) =>
      resetAdminUserPassword(id, data),
    onSuccess: () => {
      toast({
        title: 'Password reset',
        description: 'The admin password has been updated.',
        variant: 'success',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to reset password',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
