import { createFileRoute } from '@tanstack/react-router';
import AuthLayout from '@/app/(auth)/layout';
import { RecoveryForm } from '@/components/auth/recovery-form';

export const Route = createFileRoute('/reset-password')({
    headers: () => ({ 'Referrer-Policy': 'no-referrer' }),
    component: () => <AuthLayout><RecoveryForm reset /></AuthLayout>,
});
