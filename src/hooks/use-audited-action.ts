import { useEffect, useRef, useState } from 'react';
import { toast } from '@/components/ui/toast';
import { recordAuditLog } from '@/lib/api/audit';

interface AuditedActionOptions {
    action: string;
    targetService: string;
    targetResource?: string;
    successMessage?: string;
    failureMessage?: string;
}

interface AuditedActionResult<T> {
    run: (options?: { throwOnError?: boolean }) => Promise<T | undefined>;
    isPending: boolean;
}

function errorMessage(err: unknown, fallback: string): string {
    if (err instanceof Error) return err.message;
    if (typeof err === 'string') return err;
    return fallback;
}

export function useAuditedAction<T = unknown>(
    fn: () => Promise<T>,
    opts: AuditedActionOptions
): AuditedActionResult<T> {
    const [isPending, setPending] = useState(false);
    const mounted = useRef(true);

    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);

    function safeSetPending(value: boolean) {
        if (mounted.current) setPending(value);
    }

    async function run({ throwOnError = false } = {}): Promise<T | undefined> {
        safeSetPending(true);
        try {
            const result = await fn();
            toast({
                title: opts.successMessage ?? `${opts.action} succeeded`,
                description: opts.targetResource
                    ? `${opts.targetService} · ${opts.targetResource}`
                    : opts.targetService,
                variant: 'success',
            });
            void recordAuditLog({
                action: opts.action,
                target_service: opts.targetService,
                target_resource: opts.targetResource,
                status: 'success',
            });
            return result;
        } catch (err) {
            const msg = errorMessage(err, 'Action failed');
            toast({
                title: opts.failureMessage ?? `${opts.action} failed`,
                description: msg,
                variant: 'destructive',
            });
            void recordAuditLog({
                action: opts.action,
                target_service: opts.targetService,
                target_resource: opts.targetResource,
                status: 'failure',
                error_message: msg,
            });
            if (throwOnError) throw new Error(msg);
            return undefined;
        } finally {
            safeSetPending(false);
        }
    }

    return { run, isPending };
}
