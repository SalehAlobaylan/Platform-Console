'use client';

import { useState } from 'react';
import { Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';
import { workspaceHref } from '@/lib/stores/workspace-session';

export function CopyConsoleLink({ href }: { href: string }) {
    const [fallback, setFallback] = useState('');
    if (!workspaceHref(href, false)) return null;

    const copy = async () => {
        const url = new URL(href, window.location.origin).href;
        try {
            await navigator.clipboard.writeText(url);
            setFallback('');
            toast({ title: 'Link copied', variant: 'success' });
        } catch {
            setFallback(url);
        }
    };

    return <div className="min-w-0">
        <Button type="button" variant="outline" size="sm" onClick={() => void copy()}>
            <Copy aria-hidden="true" className="me-2 size-4" />Copy link
        </Button>
        {fallback && <label className="mt-2 block text-sm">
            Select and copy this link
            <Input className="mt-1" readOnly value={fallback} onFocus={event => event.currentTarget.select()} />
        </label>}
    </div>;
}
