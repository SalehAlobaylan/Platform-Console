'use client';

import { useEffect, useMemo, useState } from 'react';
import {
    Sliders,
    Plus,
    Trash2,
    Loader2,
    AlertTriangle,
    Search,
    Sparkles,
} from 'lucide-react';
import {
    Card, CardContent, CardHeader, CardTitle, CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
    useCreateQualityProfile,
    useDeleteQualityProfile,
    useProbeItem,
    useQualityProfiles,
    useResolveQualityProfile,
    useUpdateQualityProfile,
    formatSavingsBytes,
} from '@/hooks/use-quality';
import type {
    IngestSourceType,
    OutputContainer,
    ProbeResult,
    QualityProfile,
    QualityProfileInput,
} from '@/types/platform/quality';
import {
    CUSTOM_PRESET_KEY,
    CUSTOM_PRESET_META,
    getPreset,
    type IngestPreset,
} from '@/lib/constants/ingest-presets';
import { PresetPicker } from '@/components/platform/quality/preset-picker';
import { ChevronDown, RotateCcw } from 'lucide-react';

const SOURCE_TYPES: IngestSourceType[] = ['RSS', 'WEBSITE', 'TELEGRAM', 'PODCAST', 'YOUTUBE', 'UPLOAD', 'MANUAL'];
const OUTPUT_CONTAINERS: OutputContainer[] = ['mp4', 'webm', 'mov'];

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

function QualityWorkspace({ embedded = false }: { embedded?: boolean }) {
    const profiles = useQualityProfiles();

    const counts = useMemo(() => {
        const profilesList = profiles.data?.data ?? [];
        let global = 0, tenant = 0, source = 0, both = 0;
        for (const p of profilesList) {
            const hasTenant = !!p.tenant_id;
            const hasSource = !!p.source_type;
            if (!hasTenant && !hasSource) global++;
            else if (hasTenant && hasSource) both++;
            else if (hasTenant) tenant++;
            else source++;
        }
        return { global, tenant, source, both, total: profilesList.length };
    }, [profiles.data?.data]);

    return (
        <div className={embedded ? 'space-y-6' : 'space-y-6 p-6'}>
            {!embedded && (
            <header className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Sliders className="h-7 w-7 text-primary" />
                    <div>
                        <h1 className="text-2xl font-semibold">Quality Profiles</h1>
                        <p className="text-sm text-muted-foreground">
                            Quality is now managed inside Storage + Quality. This page remains as a
                            compatibility view for profile editing.
                        </p>
                    </div>
                </div>
                <Badge variant="secondary">
                    {counts.total} profile{counts.total === 1 ? '' : 's'} · {counts.global} global · {counts.tenant + counts.source + counts.both} scoped
                </Badge>
            </header>
            )}

            <ProfilesSection />
            <ResolvePreviewCard />
            <ProbeToolCard />
        </div>
    );
}

export default function EmbeddedQualityWorkspace() {
    return <QualityWorkspace embedded />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Resolve preview — "what would apply for (tenant, source)?"
// ─────────────────────────────────────────────────────────────────────────────

function ResolvePreviewCard() {
    const [tenantId, setTenantId] = useState('');
    const [sourceType, setSourceType] = useState('');
    const enabled = tenantId.trim().length > 0 || sourceType.trim().length > 0;
    const resolve = useResolveQualityProfile(tenantId.trim(), sourceType.trim(), { enabled });

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">Resolution preview</CardTitle>
                <CardDescription>
                    Pick a (tenant, source) and see which profile the ingest pipeline would use.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                        <Label>Tenant ID</Label>
                        <Input
                            placeholder="(blank = any tenant)"
                            value={tenantId}
                            onChange={(e) => setTenantId(e.target.value)}
                        />
                    </div>
                    <div>
                        <Label>Source type</Label>
                        <select
                            className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
                            value={sourceType}
                            onChange={(e) => setSourceType(e.target.value)}
                        >
                            <option value="">(any source)</option>
                            {SOURCE_TYPES.map((s) => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {!enabled ? (
                    <p className="text-xs text-muted-foreground">Enter a tenant or pick a source to see the match.</p>
                ) : resolve.isLoading ? (
                    <Skeleton className="h-16 w-full" />
                ) : resolve.data?.profile ? (
                    <div className="rounded border border-emerald-500/40 bg-emerald-500/5 p-3 text-sm">
                        <p className="font-medium">
                            Winning profile: <span className="text-emerald-300">{resolve.data.profile.name}</span>
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                            Matched on <code className="rounded bg-muted px-1">{resolve.data.matched_on}</code>
                            {' · '}
                            {resolve.data.profile.video_codec.toUpperCase()}{' '}
                            {resolve.data.profile.max_height > 0 ? `${resolve.data.profile.max_height}p` : 'no cap'}{' · '}
                            {resolve.data.profile.target_bitrate_kbps > 0
                                ? `${resolve.data.profile.target_bitrate_kbps}kbps`
                                : `CRF ${resolve.data.profile.crf}`}
                            {' · '}
                            {resolve.data.profile.audio_codec.toUpperCase()} {resolve.data.profile.audio_bitrate_kbps}k
                            {' · '}out: {resolve.data.profile.output_container}
                        </p>
                    </div>
                ) : (
                    <div className="flex items-start gap-2 rounded border border-yellow-500/40 bg-yellow-500/10 p-3 text-sm">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-400" />
                        <div>
                            <p className="font-medium">No matching profile</p>
                            <p className="text-xs text-muted-foreground">
                                Aggregation will fall back to its built-in default recipe. Create a
                                global profile (no tenant, no source) to set a baseline.
                            </p>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Profiles section — table + create/edit form
// ─────────────────────────────────────────────────────────────────────────────

const EMPTY_PROFILE: QualityProfileInput = {
    scope: 'global',
    source_type: null,
    name: '',
    description: '',
    video_codec: 'h264',
    max_height: 720,
    target_bitrate_kbps: 0,
    crf: 23,
    preset: 'fast',
    audio_codec: 'aac',
    audio_bitrate_kbps: 128,
    output_container: 'mp4',
    thumbnail_offset_seconds: 2,
    thumbnail_max_height: 360,
    allowed_input_mime_types: [],
    max_input_size_bytes: null,
    max_input_duration_sec: null,
    is_active: true,
};

function ProfilesSection() {
    const { data, isLoading } = useQualityProfiles();
    const create = useCreateQualityProfile();
    const update = useUpdateQualityProfile();
    const remove = useDeleteQualityProfile();

    const [editing, setEditing] = useState<QualityProfile | null>(null);
    const [showForm, setShowForm] = useState(false);

    if (isLoading || !data) return <Skeleton className="h-32 w-full" />;

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Profiles</CardTitle>
                        <CardDescription>
                            One row per (tenant, source) scope. The platform picks the most-specific
                            match for each ingest job.
                        </CardDescription>
                    </div>
                    <Button onClick={() => { setEditing(null); setShowForm(true); }}>
                        <Plus className="mr-2 h-4 w-4" />
                        New profile
                    </Button>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>From</TableHead>
                                <TableHead>Scope</TableHead>
                                <TableHead>Video</TableHead>
                                <TableHead>Audio</TableHead>
                                <TableHead>Output</TableHead>
                                <TableHead>Limits</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {data.data.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                                        No profiles yet. Create at least one global profile (no tenant, no source)
                                        so Aggregation has a default to fall back on.
                                    </TableCell>
                                </TableRow>
                            ) : data.data.map((p) => {
                                const preset = getPreset(p.preset_key);
                                const PresetIcon = preset?.icon;
                                return (
                                <TableRow key={p.id}>
                                    <TableCell>
                                        <div className="font-medium">{p.name}</div>
                                        <div className="text-xs text-muted-foreground">{p.description}</div>
                                    </TableCell>
                                    <TableCell className="text-xs">
                                        {preset ? (
                                            <span
                                                className="inline-flex items-center gap-1 rounded border border-border bg-muted/40 px-1.5 py-0.5"
                                                title={preset.tagline}
                                            >
                                                {PresetIcon && <PresetIcon className={`h-3 w-3 ${preset.accentColor}`} />}
                                                {preset.displayName}
                                            </span>
                                        ) : (
                                            <span className="text-muted-foreground">Custom</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="space-x-1">
                                        {p.tenant_id ? (
                                            <Badge variant="outline" title={p.tenant_id}>tenant</Badge>
                                        ) : (
                                            <Badge variant="secondary">global</Badge>
                                        )}
                                        {p.source_type && (
                                            <Badge variant="outline">{p.source_type}</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-xs">
                                        <Badge variant="outline">{p.video_codec}</Badge>{' '}
                                        {p.max_height > 0 ? `${p.max_height}p` : 'no cap'}{' · '}
                                        {p.target_bitrate_kbps > 0
                                            ? `${p.target_bitrate_kbps}kbps`
                                            : `CRF ${p.crf}`}
                                    </TableCell>
                                    <TableCell className="text-xs">
                                        {p.audio_codec} / {p.audio_bitrate_kbps}k
                                    </TableCell>
                                    <TableCell><Badge variant="outline">{p.output_container}</Badge></TableCell>
                                    <TableCell className="text-xs text-muted-foreground">
                                        {p.max_input_size_bytes
                                            ? `≤${formatSavingsBytes(p.max_input_size_bytes)}`
                                            : '—'}
                                        {p.max_input_duration_sec
                                            ? `, ≤${p.max_input_duration_sec}s`
                                            : ''}
                                    </TableCell>
                                    <TableCell className="space-x-2 text-right">
                                        <Button size="sm" variant="outline"
                                            onClick={() => { setEditing(p); setShowForm(true); }}>
                                            Edit
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="destructive"
                                            onClick={() => {
                                                if (confirm(`Delete profile "${p.name}"?`)) {
                                                    remove.mutate(p.id);
                                                }
                                            }}
                                            disabled={remove.isPending}
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {showForm && (
                <ProfileForm
                    initial={editing ?? EMPTY_PROFILE}
                    onCancel={() => { setShowForm(false); setEditing(null); }}
                    saving={create.isPending || update.isPending}
                    onSave={(input) => {
                        if (editing) {
                            update.mutate({ id: editing.id, input }, {
                                onSuccess: () => { setShowForm(false); setEditing(null); },
                            });
                        } else {
                            create.mutate(input, { onSuccess: () => setShowForm(false) });
                        }
                    }}
                />
            )}
        </div>
    );
}

function ProfileForm({
    initial,
    onSave,
    onCancel,
    saving,
}: {
    initial: QualityProfileInput | QualityProfile;
    onSave: (input: QualityProfileInput) => void;
    onCancel: () => void;
    saving: boolean;
}) {
    const isEdit = 'id' in initial && Boolean((initial as QualityProfile).id);
    const initialScope: 'global' | 'tenant' = isEdit
        ? ((initial as QualityProfile).tenant_id ? 'tenant' : 'global')
        : ((initial as QualityProfileInput).scope ?? 'global');

    // -----------------------------------------------------------------
    // Wizard step state (Phase 8). Creates start at 'pick'; edits skip
    // straight to 'configure' with values pre-loaded from the row.
    // -----------------------------------------------------------------
    type Step = 'pick' | 'configure';
    const [step, setStep] = useState<Step>(isEdit ? 'configure' : 'pick');

    // Track which preset spawned the current form values. Empty string = custom.
    const [presetKey, setPresetKey] = useState<string>(initial.preset_key ?? '');
    const lineagePreset = getPreset(presetKey);

    const [scope, setScope] = useState<'global' | 'tenant'>(initialScope);
    const [sourceType, setSourceType] = useState<string>(initial.source_type ?? '');
    const [name, setName] = useState(initial.name);
    const [description, setDescription] = useState(initial.description);

    // Video
    const [videoCodec, setVideoCodec] = useState(initial.video_codec);
    const [maxHeight, setMaxHeight] = useState(String(initial.max_height));
    const [bitrate, setBitrate] = useState(String(initial.target_bitrate_kbps));
    const [crf, setCrf] = useState(String(initial.crf));
    const [preset, setPreset] = useState(initial.preset);

    // Audio
    const [audioCodec, setAudioCodec] = useState(initial.audio_codec);
    const [audioBitrate, setAudioBitrate] = useState(String(initial.audio_bitrate_kbps));

    // Format
    const [outputContainer, setOutputContainer] = useState<OutputContainer>(initial.output_container ?? 'mp4');

    // Thumbnail
    const [thumbOffset, setThumbOffset] = useState(String(initial.thumbnail_offset_seconds ?? 2));
    const [thumbMaxH, setThumbMaxH] = useState(String(initial.thumbnail_max_height ?? 360));

    // Input limits
    const [mimeTypes, setMimeTypes] = useState((initial.allowed_input_mime_types ?? []).join(', '));
    const [maxSizeMB, setMaxSizeMB] = useState(
        initial.max_input_size_bytes != null
            ? String(Math.round(initial.max_input_size_bytes / (1024 * 1024)))
            : ''
    );
    const [maxDurationSec, setMaxDurationSec] = useState(
        initial.max_input_duration_sec != null ? String(initial.max_input_duration_sec) : ''
    );

    // -----------------------------------------------------------------
    // Helpers — apply a preset's values into form state.
    // Pulled out so both "pick a preset" and "reset to preset defaults"
    // use the same code path.
    // -----------------------------------------------------------------
    function applyPresetValues(p: QualityProfileInput) {
        setScope(p.scope ?? 'global');
        setSourceType(p.source_type ?? '');
        // intentionally NOT touching `name` / `description` — those are
        // operator inputs and survive preset changes (you don't want to
        // wipe the name when you click "Reset to preset defaults").
        setVideoCodec(p.video_codec);
        setMaxHeight(String(p.max_height));
        setBitrate(String(p.target_bitrate_kbps));
        setCrf(String(p.crf));
        setPreset(p.preset);
        setAudioCodec(p.audio_codec);
        setAudioBitrate(String(p.audio_bitrate_kbps));
        setOutputContainer(p.output_container);
        setThumbOffset(String(p.thumbnail_offset_seconds));
        setThumbMaxH(String(p.thumbnail_max_height));
        setMimeTypes((p.allowed_input_mime_types ?? []).join(', '));
        setMaxSizeMB(p.max_input_size_bytes != null ? String(Math.round(p.max_input_size_bytes / (1024 * 1024))) : '');
        setMaxDurationSec(p.max_input_duration_sec != null ? String(p.max_input_duration_sec) : '');
    }

    function handlePresetSelect(p: IngestPreset | 'custom') {
        if (p === 'custom') {
            setPresetKey(CUSTOM_PRESET_KEY);
            // For Custom, don't auto-fill — leave the form at its defaults.
        } else {
            setPresetKey(p.key);
            applyPresetValues(p.profile);
        }
        setStep('configure');
    }

    function resetToPresetDefaults() {
        if (!lineagePreset) return;
        applyPresetValues(lineagePreset.profile);
    }

    const [isActive, setIsActive] = useState(initial.is_active ?? true);

    const useBitrateMode = parseInt(bitrate, 10) > 0;
    const ffmpegPreview = useMemo(() => {
        const opts = [
            `-c:v ${videoCodec === 'h265' ? 'libx265' : videoCodec === 'av1' ? 'libaom-av1' : 'libx264'}`,
            `-preset ${preset}`,
        ];
        if (videoCodec === 'h264') opts.push('-profile:v baseline', '-level 3.0');
        opts.push(useBitrateMode ? `-b:v ${bitrate}k` : `-crf ${crf}`);
        if (parseInt(maxHeight, 10) > 0) {
            opts.push(`-vf scale=-2:'min(${maxHeight},ih)'`);
        }
        opts.push(`-c:a ${audioCodec === 'opus' ? 'libopus' : 'aac'}`);
        opts.push(`-b:a ${audioBitrate}k`);
        return opts.join(' ');
    }, [videoCodec, preset, useBitrateMode, bitrate, crf, maxHeight, audioCodec, audioBitrate]);

    function submit() {
        const allowed = mimeTypes
            .split(',')
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean);
        const maxSize = maxSizeMB ? parseInt(maxSizeMB, 10) * 1024 * 1024 : null;
        const maxDur = maxDurationSec ? parseInt(maxDurationSec, 10) : null;

        onSave({
            scope,
            source_type: (sourceType || null) as IngestSourceType | null,
            name,
            description,
            video_codec: videoCodec,
            max_height: parseInt(maxHeight, 10) || 0,
            target_bitrate_kbps: parseInt(bitrate, 10) || 0,
            crf: parseInt(crf, 10) || 23,
            preset,
            audio_codec: audioCodec,
            audio_bitrate_kbps: parseInt(audioBitrate, 10) || 128,
            output_container: outputContainer,
            thumbnail_offset_seconds: parseInt(thumbOffset, 10) || 2,
            thumbnail_max_height: parseInt(thumbMaxH, 10) || 360,
            allowed_input_mime_types: allowed,
            max_input_size_bytes: maxSize,
            max_input_duration_sec: maxDur,
            preset_key: presetKey,
            is_active: isActive,
        });
    }

    // -----------------------------------------------------------------
    // Step 1 — preset picker. New profiles only; edits skip this.
    // -----------------------------------------------------------------
    if (step === 'pick') {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>New ingest profile</CardTitle>
                    <CardDescription>
                        Pick a preset to get sensible defaults. You can tweak any field later, or pick
                        <strong> Custom</strong> to start from a blank form.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <PresetPicker selectedKey={presetKey || null} onSelect={handlePresetSelect} />
                    <div className="flex justify-end">
                        <Button variant="outline" onClick={onCancel}>Cancel</Button>
                    </div>
                </CardContent>
            </Card>
        );
    }

    // -----------------------------------------------------------------
    // Step 2 — configure. The technical sections are collapsed behind a
    // disclosure when a preset spawned the form (most operators never open
    // it); the disclosure starts OPEN for Custom because the operator
    // explicitly wanted full control.
    // -----------------------------------------------------------------
    const isCustom = presetKey === CUSTOM_PRESET_KEY || !presetKey;
    const presetMeta = lineagePreset ?? (isCustom ? CUSTOM_PRESET_META : null);

    return (
        <Card>
            <CardHeader>
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <CardTitle>{isEdit ? `Edit: ${initial.name}` : 'New ingest profile'}</CardTitle>
                        <CardDescription>
                            {isEdit
                                ? 'Tweak the name, scope, or advanced encode settings. The preset lineage is preserved.'
                                : 'Give the profile a name and scope. Advanced settings are pre-filled from the preset.'}
                        </CardDescription>
                    </div>
                    {!isEdit && (
                        <Button variant="ghost" size="sm" onClick={() => setStep('pick')}>
                            ← Change preset
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Preset lineage card — explains what the user picked + Reset button */}
                {presetMeta && (
                    <div className="flex items-start gap-3 rounded border border-border bg-muted/30 p-3">
                        {(() => { const Icon = presetMeta.icon; return <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${presetMeta.accentColor}`} />; })()}
                        <div className="flex-1">
                            <p className="text-sm font-medium">
                                From: {presetMeta.displayName}
                                {!isEdit && (
                                    <span className="ml-2 rounded bg-cyan-500/15 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-cyan-300">
                                        applied
                                    </span>
                                )}
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                                {presetMeta.tagline}
                            </p>
                        </div>
                        {lineagePreset && (
                            <Button variant="outline" size="sm" onClick={resetToPresetDefaults}>
                                <RotateCcw className="mr-1.5 h-3 w-3" />
                                Reset to defaults
                            </Button>
                        )}
                    </div>
                )}

                {/* Scope — required, always visible */}
                <Section title="Scope" hint="Which jobs this profile applies to. Most-specific match wins at resolution time.">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                        <div>
                            <Label>Tenant scope</Label>
                            <select
                                className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
                                value={scope}
                                onChange={(e) => setScope(e.target.value as 'global' | 'tenant')}
                                disabled={isEdit}
                            >
                                <option value="global">Global (any tenant)</option>
                                <option value="tenant">This tenant only</option>
                            </select>
                        </div>
                        <div>
                            <Label>Source type</Label>
                            <select
                                className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
                                value={sourceType}
                                onChange={(e) => setSourceType(e.target.value)}
                            >
                                <option value="">Any source</option>
                                {SOURCE_TYPES.map((s) => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex items-end pb-2">
                            <label className="flex items-center gap-2 text-sm">
                                <Checkbox checked={isActive} onCheckedChange={(v) => setIsActive(v === true)} />
                                Active
                            </label>
                        </div>
                    </div>
                </Section>

                {/* Identity */}
                <Section title="Identity">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div>
                            <Label>Name</Label>
                            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="global-mobile-720p" />
                        </div>
                        <div>
                            <Label>Description</Label>
                            <Input
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="What this profile is for"
                            />
                        </div>
                    </div>
                </Section>

                {/* Advanced encode settings — collapsed by default for preset-spawned
                    forms; open by default for Custom. Operators who need to tweak
                    individual fields expand this; everyone else ignores it. */}
                <details className="rounded border border-border" open={isCustom}>
                    <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm font-medium hover:bg-muted/30">
                        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform" />
                        Advanced settings
                        <span className="text-xs font-normal text-muted-foreground">
                            (codec, resolution, bitrate / CRF, audio, container, thumbnail, input limits)
                        </span>
                    </summary>
                    <div className="space-y-6 p-3 pt-0">
                {/* Video */}
                <Section title="Video">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                        <div>
                            <Label>Codec</Label>
                            <select
                                className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
                                value={videoCodec}
                                onChange={(e) => setVideoCodec(e.target.value as typeof videoCodec)}
                            >
                                <option value="h264">H.264 (baseline)</option>
                                <option value="h265">H.265 (HEVC)</option>
                                <option value="av1">AV1</option>
                            </select>
                        </div>
                        <div>
                            <Label>Max height (px)</Label>
                            <select
                                className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
                                value={maxHeight}
                                onChange={(e) => setMaxHeight(e.target.value)}
                            >
                                <option value="0">no cap</option>
                                <option value="2160">2160 (4K)</option>
                                <option value="1080">1080</option>
                                <option value="720">720</option>
                                <option value="480">480</option>
                                <option value="360">360</option>
                            </select>
                        </div>
                        <div>
                            <Label>Preset</Label>
                            <select
                                className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
                                value={preset}
                                onChange={(e) => setPreset(e.target.value)}
                            >
                                {['ultrafast','superfast','veryfast','faster','fast','medium','slow'].map((p) => (
                                    <option key={p} value={p}>{p}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <Label>Target bitrate (kbps)</Label>
                            <Input
                                type="number"
                                value={bitrate}
                                onChange={(e) => setBitrate(e.target.value)}
                                placeholder="0 = use CRF"
                            />
                        </div>
                        <div>
                            <Label>CRF (0-51)</Label>
                            <Input
                                type="number"
                                min="0"
                                max="51"
                                value={crf}
                                onChange={(e) => setCrf(e.target.value)}
                                disabled={useBitrateMode}
                            />
                        </div>
                    </div>
                </Section>

                {/* Audio */}
                <Section title="Audio">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div>
                            <Label>Codec</Label>
                            <select
                                className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
                                value={audioCodec}
                                onChange={(e) => setAudioCodec(e.target.value as typeof audioCodec)}
                            >
                                <option value="aac">AAC</option>
                                <option value="opus">Opus</option>
                            </select>
                        </div>
                        <div>
                            <Label>Bitrate (kbps)</Label>
                            <Input type="number" value={audioBitrate} onChange={(e) => setAudioBitrate(e.target.value)} />
                        </div>
                    </div>
                </Section>

                {/* Format */}
                <Section title="Output format" hint="Container drives the file extension chosen by the worker. HLS / DASH are future work.">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                        <div>
                            <Label>Container</Label>
                            <select
                                className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
                                value={outputContainer}
                                onChange={(e) => setOutputContainer(e.target.value as OutputContainer)}
                            >
                                {OUTPUT_CONTAINERS.map((c) => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </Section>

                {/* Thumbnail */}
                <Section title="Thumbnail" hint="Frame extracted from the processed video and uploaded alongside it.">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div>
                            <Label>Offset (seconds)</Label>
                            <Input
                                type="number"
                                min="0"
                                value={thumbOffset}
                                onChange={(e) => setThumbOffset(e.target.value)}
                            />
                        </div>
                        <div>
                            <Label>Max height (px)</Label>
                            <Input
                                type="number"
                                min="0"
                                value={thumbMaxH}
                                onChange={(e) => setThumbMaxH(e.target.value)}
                            />
                        </div>
                    </div>
                </Section>

                {/* Input limits */}
                <Section title="Input constraints" hint="Reject input early before any transcode work. Leave blank to accept anything.">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                        <div className="md:col-span-3">
                            <Label>Allowed MIME types (comma-separated)</Label>
                            <Input
                                value={mimeTypes}
                                onChange={(e) => setMimeTypes(e.target.value)}
                                placeholder="video/mp4, audio/mpeg, audio/mp4"
                            />
                            <p className="mt-1 text-xs text-muted-foreground">
                                Empty list = accept any MIME type.
                            </p>
                        </div>
                        <div>
                            <Label>Max input size (MB)</Label>
                            <Input
                                type="number"
                                min="0"
                                value={maxSizeMB}
                                onChange={(e) => setMaxSizeMB(e.target.value)}
                                placeholder="no limit"
                            />
                        </div>
                        <div>
                            <Label>Max input duration (sec)</Label>
                            <Input
                                type="number"
                                min="0"
                                value={maxDurationSec}
                                onChange={(e) => setMaxDurationSec(e.target.value)}
                                placeholder="no limit"
                            />
                        </div>
                    </div>
                </Section>

                    </div>
                </details>

                {/* Preview — outside the disclosure because it's the value
                    proposition for the whole form (operators need to see the
                    actual ffmpeg command being built) */}
                <div className="rounded border border-border bg-muted/30 p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">FFmpeg preview</p>
                    <code className="mt-1 block text-xs text-emerald-300">{ffmpegPreview}</code>
                </div>

                <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={onCancel}>Cancel</Button>
                    <Button onClick={submit} disabled={saving || !name.trim()}>
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
    return (
        <div className="rounded border border-border p-3 space-y-3">
            <div>
                <p className="text-sm font-medium">{title}</p>
                {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
            </div>
            {children}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Probe tool — diagnostic helper (collapsed by default)
// ─────────────────────────────────────────────────────────────────────────────

function ProbeToolCard() {
    const probe = useProbeItem();
    const [id, setId] = useState('');
    const [result, setResult] = useState<ProbeResult | null>(null);

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">
                    <Search className="mr-2 inline h-4 w-4 text-cyan-400" />
                    Probe an item
                </CardTitle>
                <CardDescription>
                    Diagnostic: ffprobe a specific content ID and see how each profile would shrink it.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <details>
                    <summary className="cursor-pointer text-sm text-muted-foreground">Open probe tool</summary>
                    <div className="mt-3 space-y-3">
                        <div className="flex items-end gap-2">
                            <div className="flex-1">
                                <Label>Content ID (UUID)</Label>
                                <Input value={id} onChange={(e) => setId(e.target.value)} placeholder="..." />
                            </div>
                            <Button
                                onClick={() => id.trim() && probe.mutate(id.trim(), { onSuccess: setResult })}
                                disabled={!id.trim() || probe.isPending}
                            >
                                {probe.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Probe
                            </Button>
                        </div>

                        {result && (
                            <>
                                <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                                    <KV label="Duration" value={result.duration_sec ? `${result.duration_sec}s` : '—'} />
                                    <KV label="Size" value={formatSavingsBytes(result.file_size_bytes)} />
                                    <KV
                                        label="Resolution"
                                        value={result.width && result.height ? `${result.width}×${result.height}` : '—'}
                                    />
                                    <KV label="Bitrate" value={result.bitrate_kbps ? `${result.bitrate_kbps} kbps` : '—'} />
                                    <KV label="Video codec" value={result.video_codec ?? '—'} />
                                    <KV label="Audio codec" value={result.audio_codec ?? '—'} />
                                    <KV label="Tier" value={result.storage_tier ?? 'primary'} />
                                </div>
                                <div>
                                    <p className="mb-2 text-sm font-medium">
                                        <Sparkles className="mr-1 inline h-4 w-4 text-emerald-400" />
                                        Projected savings by profile
                                    </p>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Profile</TableHead>
                                                <TableHead className="text-right">New size</TableHead>
                                                <TableHead className="text-right">Savings</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {result.projections.map((p) => (
                                                <TableRow key={p.profile_id}>
                                                    <TableCell><Badge variant="outline">{p.profile_name}</Badge></TableCell>
                                                    <TableCell className="text-right">{formatSavingsBytes(p.projected_size_bytes)}</TableCell>
                                                    <TableCell className="text-right text-emerald-400">
                                                        -{formatSavingsBytes(p.projected_savings_bytes)}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </>
                        )}
                    </div>
                </details>
            </CardContent>
        </Card>
    );
}

function KV({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded border border-border bg-muted/30 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="mt-1 text-sm font-medium">{value}</p>
        </div>
    );
}
