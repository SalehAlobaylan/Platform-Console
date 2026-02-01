import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DealStageSummary } from '@/types/crm';
import { DEAL_STAGES } from '@/types/crm';

interface DealsChartProps {
    data: DealStageSummary[];
    isLoading?: boolean;
}

export function DealsChart({ data, isLoading }: DealsChartProps) {
    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Deals by Stage</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="space-y-2">
                                <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                                <div className="h-8 w-full bg-muted animate-pulse rounded" />
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        );
    }

    // Find max value for scaling
    const maxValue = Math.max(...data.map((d) => d.count), 1);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Deals by Stage</CardTitle>
            </CardHeader>
            <CardContent>
                {data.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No deal data available</p>
                ) : (
                    <div className="space-y-4">
                        {DEAL_STAGES.map((stage) => {
                            const stageData = data.find((d) => d.stage === stage.id);
                            const count = stageData?.count || 0;
                            const value = stageData?.value || 0;
                            const percentage = (count / maxValue) * 100;

                            return (
                                <div key={stage.id} className="space-y-2">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="font-medium">{stage.label}</span>
                                        <div className="text-right">
                                            <span className="font-semibold">{count}</span>
                                            <span className="text-muted-foreground ml-2">
                                                ${value.toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                                        <div
                                            className="h-full rounded-full transition-all"
                                            style={{
                                                width: `${percentage}%`,
                                                backgroundColor: stage.color,
                                            }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
