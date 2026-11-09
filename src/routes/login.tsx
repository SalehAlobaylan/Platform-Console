import { createFileRoute } from '@tanstack/react-router';
import AuthLayout from '@/app/(auth)/layout';
import LoginPage from '@/app/(auth)/login/page';

export const Route = createFileRoute('/login')({
    component: () => <AuthLayout><LoginPage /></AuthLayout>,
});
