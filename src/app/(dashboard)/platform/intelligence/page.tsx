'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from '@/lib/navigation';
import { cn } from '@/lib/utils';
import { ControlRoomView } from '@/components/platform/intelligence/control-room/control-room-view';
import { ObservatoryView } from '@/components/platform/intelligence/observatory/observatory-view';
import { ValueTuningSheet } from '@/components/platform/intelligence/value-tuning-sheet';
import { useMediaIntelligenceObservatory } from '@/hooks/use-intelligence';
import {
    useMediaValueConfig,
    useUpdateMediaValueConfig,
    useRefreshMediaValueScores,
} from '@/hooks/use-intelligence';

type IntelView = 'control' | 'observatory';
const STORAGE_KEY = 'intel-view';

/**
 * The Intelligence page offers two designs for the same automated media-value
 * engine — a tile-based **Control room** and a visualization-first
 * **Observatory** — switchable in place. One data source (the observatory
 * snapshot, a superset) feeds both; the choice is remembered per operator.
 */
export default function IntelligencePage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [tuningOpen, setTuningOpen] = useState(false);

    // View: URL param wins; otherwise the remembered choice; default control.
    const paramView = searchParams.get('view');
    const [view, setView] = useState<IntelView>(paramView === 'observatory' ? 'observatory' : 'control');

    useEffect(() => {
        if (paramView === 'observatory' || paramView === 'control') {
            setView(paramView);
            return;
        }
        // No param — restore the remembered choice.
        const saved = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
        if (saved === 'observatory' || saved === 'control') setView(saved);
    }, [paramView]);

    const chooseView = (next: IntelView) => {
        setView(next);
        if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, next);
        const params = new URLSearchParams(Array.from(searchParams.entries()));
        params.set('view', next);
        router.replace(`/platform/intelligence?${params.toString()}`, { scroll: false });
    };

    const observatory = useMediaIntelligenceObservatory();
    const configQuery = useMediaValueConfig();
    const updateConfig = useUpdateMediaValueConfig();
    const refresh = useRefreshMediaValueScores();

    const snap = observatory.data;
    const shared = {
        snapshot: snap,
        loading: observatory.isLoading,
        fetching: observatory.isFetching,
        refreshing: refresh.isPending,
        onRefresh: () => refresh.mutate(),
        onTune: () => setTuningOpen(true),
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-end">
                <ViewToggle view={view} onChange={chooseView} />
            </div>

            {view === 'control' ? <ControlRoomView {...shared} /> : <ObservatoryView {...shared} />}

            <ValueTuningSheet
                open={tuningOpen}
                onOpenChange={setTuningOpen}
                config={configQuery.data?.config}
                defaults={configQuery.data?.defaults}
                saving={updateConfig.isPending}
                onSave={(data) => updateConfig.mutate(data, { onSuccess: () => setTuningOpen(false) })}
            />
        </div>
    );
}

function ViewToggle({ view, onChange }: { view: IntelView; onChange: (v: IntelView) => void }) {
    const options: { value: IntelView; label: string }[] = [
        { value: 'control', label: 'Control room' },
        { value: 'observatory', label: 'Observatory' },
    ];
    return (
        <div className="inline-flex items-center gap-1 rounded-lg border border-border bg-card p-0.5">
            {options.map((o) => (
                <button
                    key={o.value}
                    type="button"
                    onClick={() => onChange(o.value)}
                    aria-pressed={view === o.value}
                    className={cn(
                        'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                        view === o.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                    )}
                >
                    {o.label}
                </button>
            ))}
        </div>
    );
}
