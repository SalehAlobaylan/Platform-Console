import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ActivityTimeline } from '@/types/crm';
import { ACTIVITY_TYPE_LABELS } from '@/types/crm';
import { format } from 'date-fns';

interface ActivitiesChartProps {
    data: ActivityTimeline[];
    isLoading?: boolean;
}

export function ActivitiesChart({ data, isLoading }: ActivitiesChartProps) {
    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Activities Over Time</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="h-64 bg-muted animate-pulse rounded" />
                </CardContent>
            </Card>
        );
    }

    // Find max value for scaling
    const maxValue = Math.max(...data.map((d) => d.count), 1);
    const activityTypes = ['call', 'email', 'meeting', 'task', 'note'] as const;
    const typeColors = {
        call: 'bg-blue-500',
        email: 'bg-green-500',
        meeting: 'bg-purple-500',
        task: 'bg-orange-500',
        note: 'bg-gray-500',
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Activities Over Time</CardTitle>
            </CardHeader>
            <CardContent>
                {data.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No activity data available</p>
                ) : (
                    <div className="space-y-6">
                        {data.slice(0, 7).map((timeline) => (
                            <div key={timeline.date} className="space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="font-medium">
                                        {format(new Date(timeline.date), 'MMM dd, yyyy')}
                                    </span>
                                    <span className="text-muted-foreground">{timeline.count} activities</span>
                                </div>
                                <div className="flex gap-1 h-6">
                                    {activityTypes.map((type) => {
                                        const count = timeline.breakdown[type];
                                        const percentage = count / timeline.count;
                                        return count > 0 ? (
                                            <div
                                                key={type}
                                                className={`${typeColors[type]} rounded-sm transition-all hover:opacity-80`}
                                                style={{ width: `${percentage * 100}%` }}
                                                title={`${ACTIVITY_TYPE_LABELS[type]}: ${count}`}
                                            />
                                        ) : null;
                                    })}
                                </div>
                                {timeline.count > 0 && (
                                    <div className="flex gap-3 text-xs text-muted-foreground">
                                        {activityTypes.map((type) => {
                                            const count = timeline.breakdown[type];
                                            return count > 0 ? (
                                                <span key={type}>
                                                    {ACTIVITY_TYPE_LABELS[type]}: {count}
                                                </span>
                                            ) : null;
                                        })}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
