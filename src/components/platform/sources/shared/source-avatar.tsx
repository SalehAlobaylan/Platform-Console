'use client';

import { useState } from 'react';

import { cn } from '@/lib/utils';
import { sourceHealth } from '@/lib/sources/health';
import type { ContentSource } from '@/types/platform/source';

import { HEALTH_RING } from './health-meta';

interface SourceAvatarProps {
    source: ContentSource;
    /** Size + text classes, e.g. 'h-16 w-16 text-lg'. */
    className?: string;
    /** Wrap the artwork in a health-colored ring. */
    ring?: boolean;
}

/**
 * Source artwork with a graceful fallback. Uses the discovered `image_url`; if it
 * is missing or fails to load (hotlink-protected hosts), falls back to a
 * gold-tinted monogram so the gallery never shows broken images.
 */
export function SourceAvatar({ source, className, ring = false }: SourceAvatarProps) {
    const [failed, setFailed] = useState(false);
    const showImage = Boolean(source.image_url) && !failed;
    const ringClass = ring
        ? cn('ring-2 ring-offset-2 ring-offset-card', HEALTH_RING[sourceHealth(source).status])
        : '';

    return (
        <span
            className={cn(
                'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gold/15 font-semibold text-gold',
                ringClass,
                className
            )}
        >
            {showImage ? (
                <img
                    src={source.image_url}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover"
                    onError={() => setFailed(true)}
                />
            ) : (
                source.name.slice(0, 1).toUpperCase()
            )}
        </span>
    );
}
