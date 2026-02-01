import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    listCustomers,
    getCustomer,
    createCustomer,
    updateCustomer,
    deleteCustomer,
    listCustomerContacts,
    createCustomerContact,
    getCustomerTags,
    assignCustomerTags,
    removeCustomerTag,
} from '@/lib/api/crm/customers';
import {
    setContactPrimary,
    updateContact,
    deleteContact,
} from '@/lib/api/crm/contacts';
import type {
    Customer,
    Contact,
    Tag,
    ListCustomersParams,
    CreateCustomerRequest,
    UpdateCustomerRequest,
    CreateContactRequest,
    UpdateContactRequest,
} from '@/types/crm';
import { toast } from '@/components/ui/toast';

// Query keys
export const customerKeys = {
    all: ['customers'] as const,
    lists: () => [...customerKeys.all, 'list'] as const,
    list: (params: ListCustomersParams) => [...customerKeys.lists(), params] as const,
    details: () => [...customerKeys.all, 'detail'] as const,
    detail: (id: string) => [...customerKeys.details(), id] as const,
    contacts: (id: string) => [...customerKeys.detail(id), 'contacts'] as const,
    tags: (id: string) => [...customerKeys.detail(id), 'tags'] as const,
};

/**
 * Hook to fetch paginated list of customers
 */
export function useCustomers(params: ListCustomersParams = {}) {
    return useQuery({
        queryKey: customerKeys.list(params),
        queryFn: () => listCustomers(params),
    });
}

/**
 * Hook to fetch a single customer by ID
 */
export function useCustomer(id: string) {
    return useQuery({
        queryKey: customerKeys.detail(id),
        queryFn: () => getCustomer(id),
        enabled: !!id,
    });
}

/**
 * Hook to create a new customer
 */
export function useCreateCustomer() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: CreateCustomerRequest) => createCustomer(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: customerKeys.lists() });
            toast({
                title: 'Customer created',
                description: 'The customer has been created successfully.',
                variant: 'success',
            });
        },
        onError: (error: Error) => {
            toast({
                title: 'Failed to create customer',
                description: error.message,
                variant: 'destructive',
            });
        },
    });
}

/**
 * Hook to update an existing customer
 */
export function useUpdateCustomer() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: UpdateCustomerRequest }) =>
            updateCustomer(id, data),
        onSuccess: (updatedCustomer: Customer) => {
            queryClient.invalidateQueries({ queryKey: customerKeys.lists() });
            queryClient.setQueryData(customerKeys.detail(updatedCustomer.id), updatedCustomer);
            toast({
                title: 'Customer updated',
                description: 'The customer has been updated successfully.',
                variant: 'success',
            });
        },
        onError: (error: Error) => {
            toast({
                title: 'Failed to update customer',
                description: error.message,
                variant: 'destructive',
            });
        },
    });
}

/**
 * Hook to delete a customer
 */
export function useDeleteCustomer() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => deleteCustomer(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: customerKeys.lists() });
            toast({
                title: 'Customer deleted',
                description: 'The customer has been deleted.',
                variant: 'success',
            });
        },
        onError: (error: Error) => {
            toast({
                title: 'Failed to delete customer',
                description: error.message,
                variant: 'destructive',
            });
        },
    });
}

/**
 * Hook to fetch contacts for a customer
 */
export function useCustomerContacts(customerId: string) {
    return useQuery({
        queryKey: customerKeys.contacts(customerId),
        queryFn: () => listCustomerContacts(customerId),
        enabled: !!customerId,
    });
}

/**
 * Hook to create a contact for a customer
 */
export function useCreateCustomerContact() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ customerId, data }: { customerId: string; data: Omit<CreateContactRequest, 'customer_id'> }) =>
            createCustomerContact(customerId, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: customerKeys.contacts(variables.customerId) });
            toast({
                title: 'Contact created',
                description: 'The contact has been created successfully.',
                variant: 'success',
            });
        },
        onError: (error: Error) => {
            toast({
                title: 'Failed to create contact',
                description: error.message,
                variant: 'destructive',
            });
        },
    });
}

/**
 * Hook to update a contact
 */
export function useUpdateContact() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: UpdateContactRequest }) =>
            updateContact(id, data),
        onSuccess: (_, variables) => {
            // Invalidate customer contacts queries since we don't have customer_id here
            queryClient.invalidateQueries({ queryKey: customerKeys.contacts as unknown as string[] });
            toast({
                title: 'Contact updated',
                description: 'The contact has been updated successfully.',
                variant: 'success',
            });
        },
        onError: (error: Error) => {
            toast({
                title: 'Failed to update contact',
                description: error.message,
                variant: 'destructive',
            });
        },
    });
}

/**
 * Hook to delete a contact
 */
export function useDeleteContact() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => deleteContact(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: customerKeys.contacts as unknown as string[] });
            toast({
                title: 'Contact deleted',
                description: 'The contact has been deleted.',
                variant: 'success',
            });
        },
        onError: (error: Error) => {
            toast({
                title: 'Failed to delete contact',
                description: error.message,
                variant: 'destructive',
            });
        },
    });
}

/**
 * Hook to set a contact as primary
 */
export function useSetContactPrimary() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => setContactPrimary(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: customerKeys.contacts as unknown as string[] });
            toast({
                title: 'Primary contact updated',
                description: 'The primary contact has been updated.',
                variant: 'success',
            });
        },
        onError: (error: Error) => {
            toast({
                title: 'Failed to update primary contact',
                description: error.message,
                variant: 'destructive',
            });
        },
    });
}

/**
 * Hook to fetch tags for a customer
 */
export function useCustomerTags(customerId: string) {
    return useQuery({
        queryKey: customerKeys.tags(customerId),
        queryFn: () => getCustomerTags(customerId),
        enabled: !!customerId,
    });
}

/**
 * Hook to assign tags to a customer
 */
export function useAssignCustomerTags() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ customerId, tagIds }: { customerId: string; tagIds: string[] }) =>
            assignCustomerTags(customerId, tagIds),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: customerKeys.tags(variables.customerId) });
            toast({
                title: 'Tags assigned',
                description: 'The tags have been assigned successfully.',
                variant: 'success',
            });
        },
        onError: (error: Error) => {
            toast({
                title: 'Failed to assign tags',
                description: error.message,
                variant: 'destructive',
            });
        },
    });
}

/**
 * Hook to remove a tag from a customer
 */
export function useRemoveCustomerTag() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ customerId, tagId }: { customerId: string; tagId: string }) =>
            removeCustomerTag(customerId, tagId),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: customerKeys.tags(variables.customerId) });
            toast({
                title: 'Tag removed',
                description: 'The tag has been removed.',
                variant: 'success',
            });
        },
        onError: (error: Error) => {
            toast({
                title: 'Failed to remove tag',
                description: error.message,
                variant: 'destructive',
            });
        },
    });
}
