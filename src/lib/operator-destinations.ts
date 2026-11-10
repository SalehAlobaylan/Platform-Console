import type { useAuthStore } from '@/lib/stores/auth';

export const isRecordId = (value?: string | null): value is string =>
    typeof value === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value) && !/^0{8}(?:-0{4}){3}-0{12}$/.test(value);

export const deliveryHref = (id: string) => '/platform/content/' + encodeURIComponent(id) + '/delivery';

export function canReadConsole(user: ReturnType<typeof useAuthStore.getState>['user'], permission: string) {
    return Boolean(user && (user.role?.toLowerCase() === 'admin' ||
        user.permissions?.some(value => [permission, '*:*', permission.split(':')[0] + ':*'].includes(value.toLowerCase()))));
}
