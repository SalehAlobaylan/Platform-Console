import { cmsClient } from '@/lib/api/client';
import type {
  AdminUser,
  ListAdminUsersParams,
  ListAdminUsersResponse,
  CreateAdminUserRequest,
  UpdateAdminUserRequest,
  ResetAdminUserPasswordRequest,
} from './types';

export async function listAdminUsers(
  params?: ListAdminUsersParams
): Promise<ListAdminUsersResponse> {
  return cmsClient.get<ListAdminUsersResponse>('/admin/users', params);
}

export async function getAdminUser(id: string): Promise<AdminUser> {
  return cmsClient.get<AdminUser>(`/admin/users/${id}`);
}

export async function createAdminUser(
  data: CreateAdminUserRequest
): Promise<AdminUser> {
  return cmsClient.post<AdminUser>('/admin/users', data);
}

export async function updateAdminUser(
  id: string,
  data: UpdateAdminUserRequest
): Promise<AdminUser> {
  return cmsClient.put<AdminUser>(`/admin/users/${id}`, data);
}

export async function deleteAdminUser(id: string): Promise<void> {
  return cmsClient.delete<void>(`/admin/users/${id}`);
}

export async function resetAdminUserPassword(
  id: string,
  data: ResetAdminUserPasswordRequest
): Promise<void> {
  return cmsClient.post<void>(`/admin/users/${id}/password`, data);
}
