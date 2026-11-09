import { createFileRoute, Outlet } from '@tanstack/react-router';
import DashboardLayout from '@/app/(dashboard)/layout';

export const Route = createFileRoute('/_dashboard')({
    ssr: 'data-only',
    component: () => <DashboardLayout><Outlet /></DashboardLayout>,
});
