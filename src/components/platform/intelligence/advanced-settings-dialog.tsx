'use client';

import { useState, useEffect } from 'react';
import { Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { WeightSliders } from './weight-sliders';
import { WeightRadarChart } from './weight-radar-chart';
import { AlgorithmFlow } from './algorithm-flow';
import type {
  RankingConfig,
  UpdateRankingConfigRequest,
} from '@/types/platform/intelligence';

interface AdvancedSettingsDialogProps {
  config: RankingConfig | undefined;
  onSave: (data: UpdateRankingConfigRequest) => void;
  isSaving?: boolean;
}

const WEIGHT_KEYS = [
  'freshness_weight',
  'engagement_weight',
  'velocity_weight',
  'similarity_weight',
  'quality_weight',
  'diversity_weight',
  'trending_weight',
];

export function AdvancedSettingsDialog({
  config,
  onSave,
  isSaving,
}: AdvancedSettingsDialogProps) {
  const [open, setOpen] = useState(false);
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [decayHours, setDecayHours] = useState(72);
  const [velocityWindow, setVelocityWindow] = useState(6);
  const [trendingMultiplier, setTrendingMultiplier] = useState(2.0);
  const [recircEnabled, setRecircEnabled] = useState(false);
  const [recircMaxAge, setRecircMaxAge] = useState(30);
  const [completedRepeatDays, setCompletedRepeatDays] = useState(90);
  const [meaningfulRepeatDays, setMeaningfulRepeatDays] = useState(30);
  const [sampleRepeatDays, setSampleRepeatDays] = useState(7);
  const [engNorm, setEngNorm] = useState<'log' | 'linear'>('log');
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    if (config) {
      const w: Record<string, number> = {};
      for (const k of WEIGHT_KEYS) {
        w[k] = (config as unknown as Record<string, number>)[k] ?? 0;
      }
      setWeights(w);
      setDecayHours(config.freshness_decay_hours);
      setVelocityWindow(config.velocity_window_hours);
      setTrendingMultiplier(config.trending_threshold_multiplier);
      setRecircEnabled(config.recirculation_enabled);
      setRecircMaxAge(config.recirculation_max_age_days);
      setCompletedRepeatDays(config.pods_completed_repeat_days ?? 90);
      setMeaningfulRepeatDays(config.pods_meaningful_repeat_days ?? 30);
      setSampleRepeatDays(config.pods_sample_repeat_days ?? 7);
      setEngNorm(config.engagement_normalization);
      setIsActive(config.is_active);
    }
  }, [config]);

  const handleSave = () => {
    onSave({
      ...weights,
      freshness_decay_hours: decayHours,
      velocity_window_hours: velocityWindow,
      trending_threshold_multiplier: trendingMultiplier,
      recirculation_enabled: recircEnabled,
      recirculation_max_age_days: recircMaxAge,
      show_watched_when_unseen_exhausted: false,
      pods_completed_repeat_days: completedRepeatDays,
      pods_meaningful_repeat_days: meaningfulRepeatDays,
      pods_sample_repeat_days: sampleRepeatDays,
      engagement_normalization: engNorm,
      mode: 'custom',
      is_active: isActive,
    } as UpdateRankingConfigRequest);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm">
          <Settings2 className="mr-2 h-4 w-4" />
          Advanced Settings
        </Button>} />
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Advanced Ranking Configuration</DialogTitle>
          <DialogDescription>
            Fine-tune individual signal weights and algorithm parameters. Saving
            custom weights will switch the mode to &quot;Custom&quot;.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Algorithm Flow */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Algorithm Pipeline</CardTitle>
            </CardHeader>
            <CardContent>
              <AlgorithmFlow />
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Weight Sliders */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Signal Weights</CardTitle>
              </CardHeader>
              <CardContent>
                <WeightSliders weights={weights} onChange={setWeights} />
              </CardContent>
            </Card>

            {/* Radar Chart */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Weight Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <WeightRadarChart weights={weights} />
              </CardContent>
            </Card>
          </div>

          {/* Parameters */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Freshness Decay</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label>Half-life (hours)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={720}
                    value={decayHours}
                    onChange={(e) =>
                      setDecayHours(parseInt(e.target.value) || 72)
                    }
                  />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Velocity Window</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label>Window (hours)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={168}
                    value={velocityWindow}
                    onChange={(e) =>
                      setVelocityWindow(parseInt(e.target.value) || 6)
                    }
                  />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Trending Detection</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label>Threshold multiplier</Label>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    step={0.1}
                    value={trendingMultiplier}
                    onChange={(e) =>
                      setTrendingMultiplier(parseFloat(e.target.value) || 2.0)
                    }
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Advanced toggles */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">
                  Engagement Normalization
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Select
                  value={engNorm}
                  onValueChange={(v) => setEngNorm(v as 'log' | 'linear')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="log">Logarithmic</SelectItem>
                    <SelectItem value="linear">Linear</SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Recirculation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={recircEnabled}
                    onCheckedChange={(v) => setRecircEnabled(v as boolean)}
                  />
                  <Label>Enable recirculation</Label>
                </div>
                {recircEnabled && (
                  <div className="space-y-1">
                    <Label>Max age (days)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={365}
                      value={recircMaxAge}
                      onChange={(e) =>
                        setRecircMaxAge(parseInt(e.target.value) || 30)
                      }
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Feed behavior toggles */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardContent className="space-y-3 pt-6">
                <div>
                  <p className="font-medium">Pods repetition windows</p>
                  <p className="text-sm text-muted-foreground">
                    Caught-up is shown instead of recycling watched items.
                  </p>
                </div>
                {[
                  ['Completed', completedRepeatDays, setCompletedRepeatDays],
                  [
                    'Meaningful playback',
                    meaningfulRepeatDays,
                    setMeaningfulRepeatDays,
                  ],
                  [
                    'Sampled or quick skip',
                    sampleRepeatDays,
                    setSampleRepeatDays,
                  ],
                ].map(([label, value, setValue]) => (
                  <div
                    className="flex items-center gap-2"
                    key={label as string}
                  >
                    <Label className="flex-1">{label as string} (days)</Label>
                    <Input
                      className="w-20"
                      max={365}
                      min={1}
                      onChange={(event) =>
                        (setValue as (value: number) => void)(
                          Math.max(
                            1,
                            Math.min(365, parseInt(event.target.value) || 1)
                          )
                        )
                      }
                      type="number"
                      value={value as number}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex items-center justify-between pt-6">
                <div>
                  <p className="font-medium">Algorithm Active</p>
                  <p className="text-sm text-muted-foreground">
                    {isActive
                      ? 'Feeds use ranked ordering'
                      : 'Feeds use chronological ordering'}
                  </p>
                </div>
                <Checkbox
                  checked={isActive}
                  onCheckedChange={(v) => setIsActive(v as boolean)}
                />
              </CardContent>
            </Card>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Custom Configuration'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
