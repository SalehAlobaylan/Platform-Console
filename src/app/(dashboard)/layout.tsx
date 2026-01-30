import { DashboardShell } from '@/components/layout';
import { AuthGuard } from '@/components/auth';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <AuthGuard>
            <DashboardShell>{children}</DashboardShell>
        </AuthGuard>
    );
}
