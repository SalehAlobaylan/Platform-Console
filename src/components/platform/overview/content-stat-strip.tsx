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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {stats.map((stat) => {
                const Icon = stat.icon;
                return (
                    <Link key={stat.label} href={stat.href}>
                        <Card className="transition-colors hover:border-primary/30">
                            <CardContent className="flex items-center gap-4 p-5">
                                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${stat.bg}`}>
                                    <Icon className={`h-5 w-5 ${stat.color}`} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                                    {loading ? (
                                        <Skeleton className="mt-1 h-7 w-16" />
                                    ) : (
                                        <p className="text-2xl font-semibold tabular-nums">
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
