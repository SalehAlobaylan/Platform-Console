import { cn } from '@/lib/utils';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

interface DashboardShellProps {
    children: React.ReactNode;
    className?: string;
}

export function DashboardShell({ children, className }: DashboardShellProps) {
    return (
        <div className="flex h-screen overflow-hidden bg-background">
            {/* Sidebar */}
            <Sidebar />

            {/* Main content area */}
            <div className="flex flex-1 flex-col overflow-hidden">
                {/* Header */}
                <Header />

                {/* Page content */}
                <main className={cn('flex-1 overflow-y-auto p-6', className)}>
                    {children}
                </main>
            </div>
        </div>
    );
}
