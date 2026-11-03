'use client';

import { useState } from 'react';
import { Check, ClipboardCopy, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from '@/components/ui/toast';
import type {
    ServiceHealth,
    SystemHealthSnapshot,
} from '@/types/platform/system-health';

interface Props {
    snapshot?: SystemHealthSnapshot;
}

/** A service counts as "problematic" when it is not fully healthy. */
function isProblemService(svc: ServiceHealth): boolean {
    return svc.status !== 'healthy';
}

/**
 * Strip a service down to only the fields useful for debugging a failure:
 * status, latency, http, the error text, plus any unhealthy deps / failing
 * queues / unloaded models / worker trouble.
 */
function summarizeProblemService(svc: ServiceHealth) {
    return {
        name: svc.name,
        displayName: svc.displayName,
        endpointUrl: svc.endpointUrl,
        status: svc.status,
        latencyMs: svc.latencyMs,
        probes: svc.probes,
        httpStatus: svc.httpStatus,
        version: svc.version,
        rawError: svc.rawError,
        queueStatsError: svc.queueStatsError,
        unhealthyDeps: svc.deps?.filter((d) => d.status !== 'healthy') ?? [],
        failingQueues:
            svc.queues?.filter((q) => q.failed > 0) ?? [],
        unloadedModels: svc.models?.filter((m) => !m.loaded) ?? [],
        worker:
            svc.worker && (!svc.worker.alive || svc.worker.failed > 0)
                ? svc.worker
                : undefined,
    };
}

/**
 * Build a focused payload containing only errors/warnings and the context
 * directly related to them — problem services (and any service named by an
 * issue) plus missing env vars. This is the payload to hand to an engineer
 * (or an AI agent) when something is broken.
 */
function buildProblemPayload(snapshot: SystemHealthSnapshot) {
    const issueServiceNames = new Set(
        snapshot.issues.map((i) => i.service).filter(Boolean) as string[]
    );

    const relevantServices = snapshot.services.filter(
        (svc) => isProblemService(svc) || issueServiceNames.has(svc.name)
    );

    return {
        kind: 'system-health-problems',
        timestamp: snapshot.timestamp,
        durationMs: snapshot.durationMs,
        overall: snapshot.overall,
        issues: snapshot.issues,
        relatedServices: relevantServices.map(summarizeProblemService),
        missingEnv: snapshot.envAudit.filter((e) => !e.present),
    };
}

/** Human-readable markdown summary — quick to skim when pasted into chat. */
function buildMarkdownSummary(snapshot: SystemHealthSnapshot): string {
    const lines: string[] = [];
    lines.push(`# System Health — ${snapshot.overall.toUpperCase()}`);
    lines.push(`_Captured: ${new Date(snapshot.timestamp).toISOString()}_`);
    lines.push('');

    lines.push('## Services');
    for (const svc of snapshot.services) {
        const marker = svc.status === 'healthy' ? '✅' : '⚠️';
        const http = svc.httpStatus != null ? ` HTTP ${svc.httpStatus}` : '';
        const latency = svc.latencyMs != null ? ` ${svc.latencyMs}ms` : '';
        lines.push(
            `- ${marker} **${svc.displayName}** — ${svc.status}${http}${latency}`
        );
        if (svc.rawError) lines.push(`    - error: ${svc.rawError}`);
        const badDeps = svc.deps?.filter((d) => d.status !== 'healthy') ?? [];
        for (const dep of badDeps) {
            lines.push(
                `    - dep ${dep.name}: ${dep.status}${dep.detail ? ` (${dep.detail})` : ''}`
            );
        }
    }

    const missingEnv = snapshot.envAudit.filter((e) => !e.present);
    if (missingEnv.length > 0) {
        lines.push('');
        lines.push('## Missing Env Vars');
        for (const e of missingEnv) lines.push(`- ${e.key}`);
    }

    if (snapshot.issues.length > 0) {
        lines.push('');
        lines.push('## Issues');
        for (const issue of snapshot.issues) {
            const tag = issue.severity === 'critical' ? '🔴' : '🟡';
            lines.push(
                `- ${tag} ${issue.severity.toUpperCase()}${issue.service ? ` [${issue.service}]` : ''}: ${issue.message}`
            );
        }
    }

    return lines.join('\n');
}

async function copyToClipboard(text: string): Promise<boolean> {
    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        }
    } catch {
        // fall through to legacy path
    }
    try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return ok;
    } catch {
        return false;
    }
}

export function CopyDiagnostics({ snapshot }: Props) {
    const [copiedLabel, setCopiedLabel] = useState<string | null>(null);
    const disabled = !snapshot;

    async function handleCopy(label: string, payload: string, count?: number) {
        const ok = await copyToClipboard(payload);
        if (ok) {
            setCopiedLabel(label);
            setTimeout(() => setCopiedLabel(null), 1500);
            toast({
                title: `Copied: ${label}`,
                description:
                    count != null
                        ? `${count} item${count === 1 ? '' : 's'} · ${payload.length.toLocaleString()} chars`
                        : `${payload.length.toLocaleString()} chars on clipboard`,
                variant: 'success',
            });
        } else {
            toast({
                title: 'Copy failed',
                description: 'Could not write to the clipboard.',
                variant: 'destructive',
            });
        }
    }

    function onCopyFull() {
        if (!snapshot) return;
        handleCopy(
            'Full snapshot',
            JSON.stringify(snapshot, null, 2),
            snapshot.services.length
        );
    }

    function onCopyProblems() {
        if (!snapshot) return;
        const payload = buildProblemPayload(snapshot);
        handleCopy(
            'Problems only',
            JSON.stringify(payload, null, 2),
            payload.issues.length
        );
    }

    function onCopyMarkdown() {
        if (!snapshot) return;
        handleCopy('Markdown summary', buildMarkdownSummary(snapshot));
    }

    const problemCount = snapshot
        ? snapshot.issues.length +
          snapshot.services.filter(isProblemService).length
        : 0;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={disabled}>
                    {copiedLabel ? (
                        <Check className="mr-2 h-4 w-4 text-green-600" />
                    ) : (
                        <ClipboardCopy className="mr-2 h-4 w-4" />
                    )}
                    {copiedLabel ?? 'Copy diagnostics'}
                    <ChevronDown className="ml-2 h-4 w-4 opacity-70" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>Copy page status</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={onCopyProblems} disabled={disabled}>
                    <div className="flex flex-col">
                        <span>Problems only (JSON)</span>
                        <span className="text-xs text-muted-foreground">
                            Errors, warnings &amp; related services
                            {problemCount > 0 ? ` · ${problemCount}` : ''}
                        </span>
                    </div>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={onCopyFull} disabled={disabled}>
                    <div className="flex flex-col">
                        <span>Full snapshot (JSON)</span>
                        <span className="text-xs text-muted-foreground">
                            Every service, dep, queue &amp; model
                        </span>
                    </div>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={onCopyMarkdown} disabled={disabled}>
                    <div className="flex flex-col">
                        <span>Summary (Markdown)</span>
                        <span className="text-xs text-muted-foreground">
                            Human-readable overview
                        </span>
                    </div>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
