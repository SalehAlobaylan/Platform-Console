'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Image as ImageIcon, RotateCcw, X } from 'lucide-react';

import type { Dispatch } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import type { WizardAction, WizardState } from './types';

interface StepSettingsProps {
    state: WizardState;
    dispatch: Dispatch<WizardAction>;
}

export function StepSettings({ state, dispatch }: StepSettingsProps) {
    const [showAdvanced, setShowAdvanced] = useState(
        state.type === 'TELEGRAM' || state.type === 'YOUTUBE'
    );
    const suggestedIconUrl = sourceIconFromURL(state.feedUrl || state.name);

    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                        id="name"
                        placeholder="My source"
                        value={state.name}
                        onChange={(e) => dispatch({ kind: 'set_name', name: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                        Shown in the sources list. Anything memorable.
                    </p>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="interval">Fetch Interval (minutes)</Label>
                    <Input
                        id="interval"
                        type="number"
                        min={1}
                        value={state.fetchIntervalMinutes}
                        onChange={(e) =>
                            dispatch({
                                kind: 'set_fetch_interval',
                                minutes: Number(e.target.value) || 1,
                            })
                        }
                    />
                </div>
            </div>

            <div className="space-y-3">
                <Label htmlFor="image_url">Source Icon</Label>
                <div className="flex items-start gap-3">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
                        {state.imageUrl ? (
                            <img
                                src={state.imageUrl}
                                alt=""
                                className="h-full w-full object-cover"
                                onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                }}
                            />
                        ) : (
                            <ImageIcon className="h-6 w-6 text-muted-foreground" />
                        )}
                    </div>
                    <div className="min-w-0 flex-1 space-y-2">
                        <Input
                            id="image_url"
                            type="url"
                            placeholder="https://example.com/logo.png"
                            value={state.imageUrl}
                            onChange={(e) => dispatch({ kind: 'set_image_url', url: e.target.value })}
                        />
                        <div className="flex flex-wrap gap-2">
                            {suggestedIconUrl && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => dispatch({ kind: 'set_image_url', url: suggestedIconUrl })}
                                >
                                    <RotateCcw className="mr-2 h-3.5 w-3.5" />
                                    Use favicon
                                </Button>
                            )}
                            {state.imageUrl && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => dispatch({ kind: 'set_image_url', url: '' })}
                                >
                                    <X className="mr-2 h-3.5 w-3.5" />
                                    Clear
                                </Button>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Used as the News image when an item has no thumbnail. Paste a better logo URL here to override bad auto-detected icons.
                        </p>
                    </div>
                </div>
            </div>

            <div className="space-y-2">
                <Label>Status</Label>
                <div className="flex items-center gap-3">
                    <Button
                        type="button"
                        size="sm"
                        variant={state.isActive ? 'default' : 'outline'}
                        onClick={() => dispatch({ kind: 'set_is_active', active: true })}
                    >
                        Active
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        variant={!state.isActive ? 'destructive' : 'outline'}
                        onClick={() => dispatch({ kind: 'set_is_active', active: false })}
                    >
                        Disabled
                    </Button>
                </div>
            </div>

            {(state.type === 'YOUTUBE' || state.type === 'TELEGRAM') && (
                <div className="rounded-md border">
                    <button
                        type="button"
                        onClick={() => setShowAdvanced((v) => !v)}
                        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-sm font-medium hover:bg-muted/50"
                    >
                        <span>Advanced filters</span>
                        {showAdvanced ? (
                            <ChevronDown className="h-4 w-4" />
                        ) : (
                            <ChevronRight className="h-4 w-4" />
                        )}
                    </button>
                    {showAdvanced && (
                        <div className="border-t p-4">
                            {state.type === 'YOUTUBE' && <YoutubeAdvanced state={state} dispatch={dispatch} />}
                            {state.type === 'TELEGRAM' && (
                                <TelegramAdvanced state={state} dispatch={dispatch} />
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function sourceIconFromURL(value: string): string | undefined {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const candidate = trimmed.includes('://') ? trimmed : `https://${trimmed}`;
    try {
        const url = new URL(candidate);
        if (!url.hostname.includes('.')) return undefined;
        return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(url.hostname)}&sz=128`;
    } catch {
        return undefined;
    }
}

function YoutubeAdvanced({ state, dispatch }: StepSettingsProps) {
    const yt = state.youtube;
    return (
        <div className="grid gap-4 md:grid-cols-2">
            <NumberField
                label="Max videos per fetch"
                value={yt.max_results}
                placeholder="20"
                helper="1–50. Default 20."
                min={1}
                max={50}
                onChange={(v) => dispatch({ kind: 'patch_youtube', patch: { max_results: v } })}
            />
            <NumberField
                label="Max video age (hours)"
                value={yt.max_age_hours}
                placeholder="e.g. 24"
                helper="Skip videos older than this. Empty = no limit."
                min={1}
                onChange={(v) => dispatch({ kind: 'patch_youtube', patch: { max_age_hours: v } })}
            />
            <NumberField
                label="Min duration (minutes)"
                value={yt.min_duration_minutes}
                placeholder="e.g. 1"
                helper="Skip shorter videos. Empty = no minimum."
                min={0}
                onChange={(v) =>
                    dispatch({ kind: 'patch_youtube', patch: { min_duration_minutes: v } })
                }
            />
            <NumberField
                label="Max duration (minutes)"
                value={yt.max_duration_minutes}
                placeholder="e.g. 15"
                helper="Skip long videos. Prevents long podcasts from overwhelming FFmpeg."
                min={1}
                onChange={(v) =>
                    dispatch({ kind: 'patch_youtube', patch: { max_duration_minutes: v } })
                }
            />
        </div>
    );
}

function TelegramAdvanced({ state, dispatch }: StepSettingsProps) {
    const tg = state.telegram;
    const hasDurationMedia =
        tg.media_types.includes('audio') ||
        tg.media_types.includes('voice') ||
        tg.media_types.includes('video');
    const hasText = tg.media_types.includes('text');

    return (
        <div className="grid gap-4 md:grid-cols-2">
            <NumberField
                label="Max posts per fetch"
                value={tg.max_results}
                placeholder="50"
                helper="1–200. Default 50."
                min={1}
                max={200}
                onChange={(v) => dispatch({ kind: 'patch_telegram', patch: { max_results: v } })}
            />
            <NumberField
                label="Max post age (hours)"
                value={tg.max_age_hours}
                placeholder="e.g. 24"
                helper="Recommended for high-volume news channels."
                min={1}
                onChange={(v) => dispatch({ kind: 'patch_telegram', patch: { max_age_hours: v } })}
            />

            {hasDurationMedia && (
                <>
                    <NumberField
                        label="Min audio duration (sec)"
                        value={tg.min_duration_sec}
                        placeholder="120"
                        min={1}
                        onChange={(v) =>
                            dispatch({ kind: 'patch_telegram', patch: { min_duration_sec: v } })
                        }
                    />
                    <NumberField
                        label="Max audio duration (sec)"
                        value={tg.max_duration_sec}
                        placeholder="optional"
                        min={1}
                        onChange={(v) =>
                            dispatch({ kind: 'patch_telegram', patch: { max_duration_sec: v } })
                        }
                    />
                </>
            )}

            {hasText && (
                <NumberField
                    label="Min text length (chars)"
                    value={tg.min_text_length}
                    placeholder="20"
                    helper="Discard reaction / emoji-only posts. Default 20."
                    min={1}
                    max={2000}
                    onChange={(v) =>
                        dispatch({ kind: 'patch_telegram', patch: { min_text_length: v } })
                    }
                />
            )}
        </div>
    );
}

interface NumberFieldProps {
    label: string;
    value: number | undefined;
    onChange: (value: number | undefined) => void;
    placeholder?: string;
    helper?: string;
    min?: number;
    max?: number;
}

function NumberField({ label, value, onChange, placeholder, helper, min, max }: NumberFieldProps) {
    return (
        <div className="space-y-2">
            <Label>{label}</Label>
            <Input
                type="number"
                min={min}
                max={max}
                placeholder={placeholder}
                value={value ?? ''}
                onChange={(e) => {
                    const v = e.target.value;
                    if (v === '') onChange(undefined);
                    else {
                        const n = Number(v);
                        onChange(Number.isFinite(n) ? n : undefined);
                    }
                }}
            />
            {helper && <p className="text-xs text-muted-foreground">{helper}</p>}
        </div>
    );
}
