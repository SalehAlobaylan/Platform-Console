import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cmsClient } from '@/lib/api/client';

type Window = {
    revision: number; from: string; until: string; available: boolean; reason?: string;
    requests: number; deferred: number; observe_would_defer: number; bypassed: number;
};

export function WorkloadPolicyComparison({ revision }: { revision?: number }) {
    const [before, setBefore] = useState('');
    const [after, setAfter] = useState(revision ? String(revision) : '');
    const [workClass, setWorkClass] = useState('');
    const [request, setRequest] = useState<{ before_revision: string; after_revision: string; class: string }>();
    const query = useQuery({
        queryKey: ['workload-policy-outcomes', request],
        enabled: Boolean(request),
        retry: false,
        queryFn: ({ signal }) => cmsClient.get<{ data: Window[] }>('/admin/workload/policy-outcomes', request, signal).then(result => result.data),
    });
    return <details className="space-y-2 rounded-lg border p-4">
        <summary className="cursor-pointer font-medium">Compare recorded outcomes</summary>
        <p className="text-sm text-muted-foreground">Compares the first 24 hours of two revisions for the same workload class. This describes observed requests and deferrals.</p>
        <form className="flex flex-wrap items-end gap-2" onSubmit={event => {
            event.preventDefault();
            if (!workClass.trim() || Number(after) <= Number(before)) return;
            setRequest({ before_revision: before, after_revision: after, class: workClass.trim() });
        }}>
            <label className="text-sm">Earlier revision<Input type="number" min={1} required value={before} onChange={event => setBefore(event.target.value)} /></label>
            <label className="text-sm">Later revision<Input type="number" min={1} required value={after} onChange={event => setAfter(event.target.value)} /></label>
            <label className="text-sm">Workload class<Input required maxLength={48} value={workClass} onChange={event => setWorkClass(event.target.value)} /></label>
            <Button type="submit" disabled={query.isFetching || Number(after) <= Number(before)}>Compare</Button>
        </form>
        {query.isFetching && <p role="status">Checking recorded requests…</p>}
        {query.isError && <p role="alert">Comparison is unavailable.</p>}
        {query.data?.map(window => <div key={window.revision} className="rounded-md border p-2 text-sm">
            <strong>Revision {window.revision}</strong>
            {window.available ? <><p className="text-muted-foreground">{new Date(window.from).toLocaleString()} – {new Date(window.until).toLocaleString()}</p><p>{window.requests} requests · {window.deferred} deferred · {window.observe_would_defer} Observe estimates · {window.bypassed} bypassed</p></> : <p>{window.reason}</p>}
        </div>)}
    </details>;
}
