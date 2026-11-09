import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { notifySessionChange, withSessionLock } from '@/lib/auth-session';
import { clearAuthState } from '@/lib/stores/auth';
import { authRequest, parseAuthError } from '@/lib/api/iam/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function RecoveryForm({ reset = false }: { reset?: boolean }) {
    const navigate = useNavigate();
    const [token, setToken] = useState<string | undefined>();
    const [ready, setReady] = useState(false);
    const [pending, setPending] = useState(false);
    const [done, setDone] = useState(false);
    const [error, setError] = useState('');
    useEffect(() => {
        setReady(true);
        if (!reset) return;
        const fragment = new URLSearchParams(window.location.hash.slice(1));
        const raw = fragment.get('token');
        if (raw) window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
        setToken((previous) => raw ?? previous ?? '');
    }, [reset]);

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const values = new FormData(event.currentTarget);
        const password = String(values.get('password') ?? '');
        if (reset && password !== values.get('confirm')) {
            setError('Enter the same password in both fields.');
            return;
        }
        setPending(true);
        setError('');
        try {
            const result = reset
                ? await withSessionLock(() => authRequest('/api/auth/reset-password', { body: { token, new_password: password } }))
                : await authRequest('/api/auth/forgot-password', {
                    body: { email: String(values.get('email') ?? '') }, timeout: 15_000,
                });
            if (!result.ok) throw await parseAuthError(result);
            setToken('');
            if (reset) {
                clearAuthState();
                notifySessionChange('logout');
                await navigate({ to: '/login', search: { reason: 'password_reset' }, replace: true });
                return;
            }
            setDone(true);
        } catch (cause) {
            setError(cause instanceof Error ? 'Recovery is temporarily unavailable. Try again.' :
                (cause as { message?: string }).message ?? 'Recovery is temporarily unavailable. Try again.');
        } finally {
            setPending(false);
        }
    }

    return (
        <Card className="mx-4 w-full max-w-sm">
            <CardHeader><h1 className="text-xl font-semibold">{reset ? 'Set a new password' : 'Reset your password'}</h1></CardHeader>
            <CardContent className="space-y-4">
                {done ? (
                    <p role="status" className="text-sm">If an account matches that email, you’ll receive a reset link.</p>
                ) : reset && !token ? (
                    token === '' && <p role="alert" className="text-sm">This reset link is missing or invalid.</p>
                ) : (
                    <form method="post" onSubmit={(event) => void submit(event)} className="space-y-4">
                        {reset ? <>
                            <div className="space-y-2"><Label htmlFor="password">New password</Label>
                                <Input id="password" name="password" type="password" autoComplete="new-password" minLength={4} required disabled={pending} />
                            </div>
                            <div className="space-y-2"><Label htmlFor="confirm">Confirm new password</Label>
                                <Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={4} required disabled={pending} />
                            </div>
                        </> : <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" name="email" type="email" autoComplete="username" maxLength={254} required disabled={pending} />
                        </div>}
                        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
                        <Button type="submit" className="w-full" disabled={!ready || pending}>
                            {pending ? 'Working…' : reset ? 'Update password' : 'Send reset link'}
                        </Button>
                    </form>
                )}
                {reset && !done && <Link to="/forgot-password" className="block text-sm underline">Request a new link</Link>}
                <Link to="/login" className="block text-sm underline">Back to sign-in</Link>
            </CardContent>
        </Card>
    );
}
