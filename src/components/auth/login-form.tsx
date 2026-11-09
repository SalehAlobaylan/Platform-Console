'use client';

import { useState, type FormEvent } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff } from 'lucide-react';
import { Link } from '@tanstack/react-router';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const loginSchema = z.object({
    email: z.string().trim().email('Please enter a valid email address'),
    password: z.string().min(1, 'Password is required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export function LoginForm({ onSignIn, pending, recovery }: {
    onSignIn: (email: string, password: string) => Promise<void>;
    pending: boolean;
    recovery: boolean;
}) {
    const [showPassword, setShowPassword] = useState(false);
    const { register, handleSubmit, setValue, formState: { errors } } = useForm<LoginFormData>({
        resolver: zodResolver(loginSchema),
        defaultValues: { email: '', password: '' },
    });

    const submit = (event: FormEvent<HTMLFormElement>) => {
        // Some password managers update native input values without React events.
        const data = new FormData(event.currentTarget);
        setValue('email', String(data.get('email') ?? ''));
        setValue('password', String(data.get('password') ?? ''));
        void handleSubmit(({ email, password }) => onSignIn(email, password))(event);
    };

    return (
        <form method="post" onSubmit={submit} className="space-y-4" noValidate>
            <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" autoComplete="username" {...register('email')}
                    aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'email-error' : undefined} />
                {errors.email && <p id="email-error" className="text-sm text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="password">Password</Label>
                    {recovery && <Link to="/forgot-password" className="text-xs underline">Forgot password?</Link>}
                </div>
                <div className="relative">
                    <Input id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password"
                        className="pe-11" {...register('password')}
                        aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? 'password-error' : undefined} />
                    <Button type="button" variant="ghost" size="icon" className="absolute inset-y-0 end-0 size-9"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        onClick={() => setShowPassword((value) => !value)}>
                        {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                    </Button>
                </div>
                {errors.password && <p id="password-error" className="text-sm text-destructive">{errors.password.message}</p>}
            </div>
            <Button type="submit" className="w-full" disabled={pending}>Sign in</Button>
        </form>
    );
}
