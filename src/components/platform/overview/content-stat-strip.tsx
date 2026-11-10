'use client';

import Link from '@/lib/console-link';
import { Database, FileText, Newspaper, Video, Radio, type LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export interface ContentStat {
    label: string;
    value?: number;
    icon: LucideIcon;
    href: string;
    color: string;
    bg: string;
}

/**
 * The library-scale headline: total content, sources, and the type mix
 * (News / Video / Podcast). Restores the old dashboard's colored KPI tiles,
 * enhanced from raw status counts into a scale + composition read that does
 * not duplicate the pipeline status funnel below.
 */
export function ContentStatStrip({ stats, loading }: { stats: ContentStat[]; loading: boolean }) {
    return (
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-3 xl:grid-cols-5">
            {stats.map((stat) => {
                const Icon = stat.icon;
                return (
                    <Link key={stat.label} href={stat.href} className="min-w-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        <Card className="h-full transition-colors hover:border-primary/30">
                            <CardContent className="flex items-center gap-2 p-3 sm:gap-3 sm:p-4">
                                <div className={`flex size-7 shrink-0 items-center justify-center rounded-md sm:size-9 ${stat.bg}`}>
                                    <Icon className={`size-4 sm:size-5 ${stat.color}`} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                                    {loading ? (
                                        <Skeleton className="mt-1 h-6 w-14 max-w-full" />
                                    ) : (
                                        <p className="break-words text-lg font-semibold tabular-nums sm:text-2xl">
                                            {stat.value?.toLocaleString() ?? '—'}
                                        </p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </Link>
                );
            })}
        </div>
    );
}

export const CONTENT_STAT_ICONS = { Database, FileText, Newspaper, Video, Radio };
