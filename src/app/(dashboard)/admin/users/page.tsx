'use client';

import { useMemo, useState } from 'react';
import {
  Plus,
  Search,
  KeyRound,
  Pencil,
  Trash2,
  ShieldCheck,
  ShieldX,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  useAdminUsers,
  useCreateAdminUser,
  useDeleteAdminUser,
  useResetAdminUserPassword,
  useUpdateAdminUser,
} from '@/hooks/use-admin-users';
import { EmptyState } from '@/components/shared/empty-state';
import { PageSkeleton } from '@/components/shared/loading-state';
import type { AdminUser } from '@/lib/api/cms/types';
import { useAuth } from '@/hooks/use-auth';

const roleOptions = ['admin', 'manager', 'agent'];
const permissionOptions = [
  'read:sources',
  'write:sources',
  'read:customers',
  'write:customers',
  'read:deals',
  'write:deals',
  'read:activities',
  'write:activities',
];

type DialogMode = 'create' | 'edit' | 'password' | 'delete';

export default function AdminUsersPage() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dialogMode, setDialogMode] = useState<DialogMode | null>(null);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);

  const [formState, setFormState] = useState({
    email: '',
    password: '',
    role: 'admin',
    permissions: [] as string[],
    is_active: true,
  });

  const limit = 10;
  const shouldFetch = Boolean(user && user.role === 'admin');
  const { data, isLoading, error } = useAdminUsers({
    page,
    limit,
    search: search || undefined,
    role: roleFilter === 'all' ? undefined : roleFilter,
    is_active: statusFilter === 'all' ? undefined : statusFilter === 'active',
    enabled: shouldFetch,
  });

  const createMutation = useCreateAdminUser();
  const updateMutation = useUpdateAdminUser();
  const deleteMutation = useDeleteAdminUser();
  const resetPasswordMutation = useResetAdminUserPassword();

  const isBusy =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending ||
    resetPasswordMutation.isPending;

  const openCreate = () => {
    setSelectedUser(null);
    setFormState({ email: '', password: '', role: 'admin', permissions: [], is_active: true });
    setDialogMode('create');
  };

  const openEdit = (user: AdminUser) => {
    setSelectedUser(user);
    setFormState({
      email: user.email,
      password: '',
      role: user.role,
      permissions: user.permissions || [],
      is_active: user.is_active,
    });
    setDialogMode('edit');
  };

  const openPasswordReset = (user: AdminUser) => {
    setSelectedUser(user);
    setFormState((prev) => ({ ...prev, password: '' }));
    setDialogMode('password');
  };

  const openDelete = (user: AdminUser) => {
    setSelectedUser(user);
    setDialogMode('delete');
  };

  const closeDialog = () => {
    setDialogMode(null);
  };

  const handleSubmit = () => {
    if (dialogMode === 'create') {
      createMutation.mutate(
        {
          email: formState.email,
          password: formState.password,
          role: formState.role,
          permissions: formState.permissions,
          is_active: formState.is_active,
        },
        { onSuccess: closeDialog }
      );
    }
    if (dialogMode === 'edit' && selectedUser) {
      updateMutation.mutate(
        {
          id: selectedUser.id,
          data: {
            email: formState.email,
            role: formState.role,
            permissions: formState.permissions,
            is_active: formState.is_active,
          },
        },
        { onSuccess: closeDialog }
      );
    }
    if (dialogMode === 'password' && selectedUser) {
      resetPasswordMutation.mutate(
        {
          id: selectedUser.id,
          data: { password: formState.password },
        },
        { onSuccess: closeDialog }
      );
    }
    if (dialogMode === 'delete' && selectedUser) {
      deleteMutation.mutate(selectedUser.id, { onSuccess: closeDialog });
    }
  };

  const activeDialogTitle = useMemo(() => {
    switch (dialogMode) {
      case 'create':
        return 'Create Admin User';
      case 'edit':
        return 'Edit Admin User';
      case 'password':
        return 'Reset Password';
      case 'delete':
        return 'Delete Admin User';
      default:
        return '';
    }
  }, [dialogMode]);

  if (isLoading) {
    return <PageSkeleton />;
  }

  if (!user || user.role !== 'admin') {
    return (
      <EmptyState
        icon={ShieldX}
        title="Permission denied"
        description="You do not have access to manage admin users."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Users</h1>
          <p className="text-muted-foreground">Manage access to the Platform Console</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          New Admin
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
        <Select
          value={roleFilter}
          onValueChange={(value) => {
            setRoleFilter(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            {roleOptions.map((role) => (
              <SelectItem key={role} value={role}>{role}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={statusFilter}
          onValueChange={(value) => {
            setStatusFilter(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Disabled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error ? (
        <div className="rounded-md border p-8 text-center text-destructive">
          Failed to load admin users. Please try again.
        </div>
      ) : data?.data.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="No admin users"
          description="Create your first admin user to grant platform access."
          action={{ label: 'Create Admin', onClick: openCreate }}
        />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Permissions</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.data.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.email}</TableCell>
                  <TableCell className="capitalize">{user.role}</TableCell>
                  <TableCell>
                    <Badge variant={user.is_active ? 'success' : 'secondary'}>
                      {user.is_active ? 'Active' : 'Disabled'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {user.permissions?.length ? (
                      <span className="text-xs text-muted-foreground">
                        {user.permissions.join(', ')}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">None</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => openPasswordReset(user)} title="Reset password">
                        <KeyRound className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(user)} title="Edit">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openDelete(user)} title="Delete">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {data && data.total_pages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className={page <= 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
              />
            </PaginationItem>
            {Array.from({ length: data.total_pages }, (_, i) => i + 1).map((p) => (
              <PaginationItem key={p}>
                <PaginationLink
                  onClick={() => setPage(p)}
                  isActive={p === page}
                  className="cursor-pointer"
                >
                  {p}
                </PaginationLink>
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext
                onClick={() => setPage((p) => Math.min(data.total_pages, p + 1))}
                className={page >= data.total_pages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}

      <Dialog open={!!dialogMode} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{activeDialogTitle}</DialogTitle>
            <DialogDescription>
              {dialogMode === 'delete'
                ? 'This action cannot be undone.'
                : 'Manage admin access to the Platform Console.'}
            </DialogDescription>
          </DialogHeader>

          {dialogMode === 'delete' ? (
            <div className="flex items-center gap-3 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
              <ShieldX className="h-4 w-4" />
              Delete {selectedUser?.email}?
            </div>
          ) : (
            <div className="space-y-4">
              {(dialogMode === 'create' || dialogMode === 'edit') && (
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    value={formState.email}
                    onChange={(e) => setFormState((prev) => ({ ...prev, email: e.target.value }))}
                    placeholder="admin@example.com"
                    disabled={isBusy}
                  />
                </div>
              )}
              {(dialogMode === 'create' || dialogMode === 'password') && (
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formState.password}
                    onChange={(e) => setFormState((prev) => ({ ...prev, password: e.target.value }))}
                    placeholder="••••••••"
                    disabled={isBusy}
                  />
                </div>
              )}
              {(dialogMode === 'create' || dialogMode === 'edit') && (
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select
                    value={formState.role}
                    onValueChange={(value) => setFormState((prev) => ({ ...prev, role: value }))}
                  >
                    <SelectTrigger id="role">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      {roleOptions.map((role) => (
                        <SelectItem key={role} value={role}>{role}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {(dialogMode === 'create' || dialogMode === 'edit') && (
                <div className="space-y-2">
                  <Label>Permissions</Label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {permissionOptions.map((permission) => {
                      const isChecked = formState.permissions.includes(permission);
                      return (
                        <label key={permission} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              setFormState((prev) => ({
                                ...prev,
                                permissions: e.target.checked
                                  ? [...prev.permissions, permission]
                                  : prev.permissions.filter((p) => p !== permission),
                              }));
                            }}
                          />
                          {permission}
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
              {(dialogMode === 'create' || dialogMode === 'edit') && (
                <div className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <p className="text-sm font-medium">Active</p>
                    <p className="text-xs text-muted-foreground">Allow this user to access the console</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={formState.is_active}
                    onChange={(e) =>
                      setFormState((prev) => ({ ...prev, is_active: e.target.checked }))
                    }
                  />
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={isBusy}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isBusy} variant={dialogMode === 'delete' ? 'destructive' : 'default'}>
              {dialogMode === 'delete' ? 'Delete' : dialogMode === 'password' ? 'Reset Password' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
