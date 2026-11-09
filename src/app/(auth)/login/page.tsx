'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { LoginForm } from '@/components/auth';
import { Button } from '@/components/ui/button';
import { useRouter } from '@/lib/navigation';
import { useAuthStore } from '@/lib/stores/auth';
import { useConsoleAuthCapabilities } from '@/lib/console-auth-capabilities';
import { canUsePasskeys, signInWithPasskey } from '@/lib/console-passkeys';

export default function LoginPage({ localQuickSignIn, returnTo, reason }: {
    localQuickSignIn: boolean;
    returnTo: string;
    reason?: 'runtime_changed' | 'password_reset';
}) {
    const router = useRouter();
    const { isAuthenticated, isLoading, sessionIssue, checkAuth } = useAuthStore();
    const [error, setError] = useState('');
    const [passkeySupport, setPasskeySupport] = useState(false);
    const capabilities = useConsoleAuthCapabilities();
    useEffect(() => { setPasskeySupport(canUsePasskeys()); }, []);
    useEffect(() => {
        if (isAuthenticated) router.replace(returnTo, { fromPath: '/login' });
    }, [isAuthenticated, returnTo, router]);

    async function signIn(authenticate: () => Promise<void>, method: 'password' | 'quick' | 'passkey') {
        if (useAuthStore.getState().isLoading) return;
        setError('');
        try {
            await authenticate();
        } catch (cause) {
            const code = (cause as { code?: string })?.code;
            const name = (cause as { name?: string })?.name;
            if (code === 'runtime_changed') {
                setError('The local app restarted. Reload this page before signing in.');
            } else if (code === 'invalid_credentials' && method === 'password') {
                setError('The email or password is incorrect, or this account can’t sign in.');
            } else if (code === 'session_unavailable' || name === 'AbortError' || name === 'TimeoutError' || name === 'TypeError') {
                setError('The sign-in service is temporarily unavailable. Try again.');
            } else if (method === 'passkey') {
                setError('Passkey sign-in didn’t complete. Try again or use your password.');
            } else if (method === 'quick') {
                setError('Quick sign-in didn’t complete. Try again or use your password.');
            } else {
                setError('Couldn’t sign in. Try again.');
            }
        }
    }

    const logoClassName = 'flex size-12 items-center justify-center rounded-xl bg-primary/10';
    const logo = (
        <>
            <span aria-hidden="true" className="block h-9 w-8 bg-contain bg-center bg-no-repeat dark:hidden"
                style={{ backgroundImage: "url('/images/wahb_mark_transparent.png')" }} />
            <span aria-hidden="true" className="hidden h-9 w-8 bg-contain bg-center bg-no-repeat dark:block"
                style={{ backgroundImage: "url('/images/wahb_mark_transparent_dark.png')" }} />
        </>
    );

    return (
        <Card className="mx-4 w-full max-w-sm shadow-sm">
            <CardHeader className="items-center gap-2 text-center">
                {localQuickSignIn ? (
                    <button type="button" aria-label="Quick sign in" disabled={isLoading}
                        className={`${logoClassName} enabled:cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`}
                        onClick={() => void signIn(useAuthStore.getState().quickSignIn, 'quick')}>
                        {logo}
                    </button>
                ) : <div aria-hidden="true" className={logoClassName}>{logo}</div>}
                <h1 className="text-xl font-semibold tracking-tight">Sign in to Platform Console</h1>
            </CardHeader>
            <CardContent className="space-y-4">
                {reason === 'password_reset' && <p role="status" className="text-sm">
                    Your password was updated. Sign in with your new password.
                </p>}
                {(reason === 'runtime_changed' || sessionIssue === 'runtime_changed') && (
                    <p role="status" className="text-sm text-muted-foreground">The local app restarted. Sign in again to continue.</p>
                )}
                {sessionIssue === 'unavailable' && (
                    <div className="space-y-2">
                        <p role="alert" className="text-sm">We couldn’t check your session.</p>
                        <Button type="button" variant="outline" size="sm" onClick={() => void checkAuth()}>Retry</Button>
                    </div>
                )}
                {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
                {capabilities?.passkeys && passkeySupport && (
                    <Button type="button" variant="outline" className="w-full" disabled={isLoading}
                        onClick={() => void signIn(() => useAuthStore.getState().completeSignIn(signInWithPasskey), 'passkey')}>
                        Sign in with a passkey
                    </Button>
                )}
                <LoginForm pending={isLoading} recovery={capabilities?.recovery === true}
                    onSignIn={(email, password) => signIn(() => useAuthStore.getState().login(email, password), 'password')} />
            </CardContent>
        </Card>
    );
}
