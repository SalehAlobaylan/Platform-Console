import { createFileRoute } from '@tanstack/react-router';
import AuthLayout from '@/app/(auth)/layout';
import { RecoveryForm } from '@/components/auth/recovery-form';

export const Route = createFileRoute('/forgot-password')({
    component: () => <AuthLayout><RecoveryForm /></AuthLayout>,
});
