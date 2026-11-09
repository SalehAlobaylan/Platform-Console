'use client';

import { useState, type MouseEvent } from 'react';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { LoginForm } from '@/components/auth';
import { useAuthStore } from '@/lib/stores/auth';

const loginFormId = 'console-login';

async function savedPassword() {
    // Some browsers expose navigator.credentials only for passkeys.
    if (!('PasswordCredential' in window) || !navigator.credentials) return null;
    const options = { password: true, mediation: 'optional' } as const;
    try {
        const credential = await navigator.credentials.get(options);
        return credential?.type === 'password' && 'password' in credential && typeof credential.password === 'string'
            ? { email: credential.id, password: credential.password }
            : null;
    } catch {
        return null;
    }
}

function WahbLoginMark() {
    return (
        <>
            <span
                aria-hidden="true"
                className="block h-9 w-8 bg-contain bg-center bg-no-repeat dark:hidden"
                style={{ backgroundImage: "url('/images/wahb_mark_transparent.png')" }}
            />
            <span
                aria-hidden="true"
                className="hidden h-9 w-8 bg-contain bg-center bg-no-repeat dark:block"
                style={{ backgroundImage: "url('/images/wahb_mark_transparent_dark.png')" }}
            />
            <span className="sr-only">Wahb</span>
        </>
    );
}

export default function LoginPage() {
    const isLoading = useAuthStore((state) => state.isLoading);
    const [isCheckingSavedLogin, setIsCheckingSavedLogin] = useState(false);
    const [quickSignInHint, setQuickSignInHint] = useState('');

    async function quickSignIn(event: MouseEvent<HTMLButtonElement>) {
        const form = event.currentTarget.form;
        const email = form?.elements.namedItem('email');
        const password = form?.elements.namedItem('password');
        if (!form || !(email instanceof HTMLInputElement) || !(password instanceof HTMLInputElement)) return;

        setQuickSignInHint('');
        if (!email.value && !password.value) {
            setIsCheckingSavedLogin(true);
            const saved = await savedPassword();
            setIsCheckingSavedLogin(false);
            const auth = useAuthStore.getState();
            if (!form.isConnected || auth.isLoading || auth.isAuthenticated) return;
            if (saved && !email.value && !password.value) {
                email.value = saved.email;
                if (email.value && email.validity.valid) password.value = saved.password;
            }
        }

        if (email.value && email.validity.valid && password.value) {
            form.requestSubmit();
            return;
        }

        setQuickSignInHint('Enter your Console credentials, or select a saved login from your password manager.');
        (!email.value || !email.validity.valid ? email : password).focus();
    }

    return (
        <div className="w-full max-w-sm px-4">
            <div className="mb-8 flex flex-col items-center gap-3">
                <button
                    type="button"
                    form={loginFormId}
                    aria-label="Quick sign in"
                    title="Sign in with a saved login or the credentials in the form"
                    disabled={isLoading || isCheckingSavedLogin}
                    onClick={quickSignIn}
                    className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 shadow-sm transition-transform enabled:cursor-pointer enabled:hover:scale-110 enabled:active:scale-95 disabled:opacity-60"
                >
                    <WahbLoginMark />
                </button>
                <div className="text-center">
                    <h1 className="text-xl font-semibold tracking-tight">Platform Console</h1>
                    <p className="mt-0.5 text-sm text-muted-foreground">Wahb Content Management</p>
                </div>
            </div>

            <Card className="shadow-sm">
                <CardHeader className="space-y-1 pb-4">
                    <CardTitle className="text-lg text-center">Sign in</CardTitle>
                    <CardDescription className="text-center text-xs">
                        Enter your credentials to continue
                    </CardDescription>
                    <p role="status" className={quickSignInHint ? 'text-center text-xs text-muted-foreground' : 'sr-only'}>
                        {quickSignInHint}
                    </p>
                </CardHeader>
                <CardContent>
                    <LoginForm id={loginFormId} />
                </CardContent>
            </Card>
        </div>
    );
}
