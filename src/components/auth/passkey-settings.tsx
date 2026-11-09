'use client';

import { useState, type FormEvent, type RefObject } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
    Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { addPasskey, canUsePasskeys, listPasskeys, removePasskey } from '@/lib/console-passkeys';
import { useAuthStore } from '@/lib/stores/auth';

export function PasskeySettings({ open, onOpenChange, returnFocus }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    returnFocus?: RefObject<HTMLButtonElement | null>;
}) {
    const client = useQueryClient();
    const userId = useAuthStore((state) => state.user?.id);
    const key = ['console-passkeys', userId];
    const [action, setAction] = useState<'add' | { id: string } | null>(null);
    const items = useQuery({ queryKey: key, queryFn: listPasskeys, enabled: open && Boolean(userId), retry: false });
    const [pending, setPending] = useState(false);
    const [error, setError] = useState('');

    function select(selection: typeof action) {
        setError('');
        setAction(selection);
    }

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const values = new FormData(event.currentTarget);
        const password = String(values.get('password') ?? '');
        event.currentTarget.reset();
        if (!action || !password || pending) return;
        setPending(true);
        setError('');
        try {
            if (action === 'add') await addPasskey(password);
            else await removePasskey(action.id, password);
            setAction(null);
            await client.invalidateQueries({ queryKey: key });
        } catch (cause) {
            const failure = cause as { name?: string; message?: string };
            setError(failure.name === 'NotAllowedError' ? 'Passkey setup was cancelled. You can try again.' :
                failure.message ?? 'Couldn’t update your passkeys.');
        } finally {
            setPending(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={(value) => {
            if (pending) return;
            if (!value) select(null);
            onOpenChange(value);
        }}>
            <DialogContent finalFocus={returnFocus} showClose={!pending}>
                <DialogHeader>
                    <DialogTitle>Passkeys</DialogTitle>
                    <DialogDescription>Sign in with your device or a security key.</DialogDescription>
                </DialogHeader>
                {items.isPending ? <p role="status" className="text-sm">Loading passkeys…</p> :
                    items.isError ? <div className="space-y-2">
                        <p role="alert" className="text-sm">Couldn’t load your passkeys.</p>
                        <Button variant="outline" onClick={() => void items.refetch()}>Retry</Button>
                    </div> : items.data?.length ? (
                        <ul className="divide-y">
                            {items.data.map((item) => (
                                <li key={item.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                                    <span>Passkey added {new Date(item.created_at).toLocaleDateString()}
                                        {item.last_used_at && <span className="block text-muted-foreground">
                                            Last used {new Date(item.last_used_at).toLocaleDateString()}
                                        </span>}
                                    </span>
                                    <Button variant="ghost" size="sm" disabled={pending}
                                        onClick={() => select({ id: item.id })}>Remove</Button>
                                </li>
                            ))}
                        </ul>
                    ) : <p className="text-sm text-muted-foreground">You haven’t added a passkey.</p>}
                {canUsePasskeys() && !action && <Button onClick={() => select('add')}>Add a passkey</Button>}
                {action && (
                    <form method="post" onSubmit={(event) => void submit(event)} className="space-y-3">
                        <div className="space-y-2">
                            <Label htmlFor="passkey-password">Current password</Label>
                            <Input id="passkey-password" name="password" type="password" autoComplete="current-password"
                                required disabled={pending} />
                        </div>
                        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
                        <div className="flex gap-2">
                            <Button type="submit" disabled={pending}>
                                {pending ? 'Working…' : action === 'add' ? 'Create passkey' : 'Remove passkey'}
                            </Button>
                            <Button type="button" variant="outline" disabled={pending} onClick={() => select(null)}>Cancel</Button>
                        </div>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}
