import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/toast';
import {
  getAISpendRollups,
  getAISpendRuns,
  getAISpendStatus,
  runAISpendGovernor,
  updateAISpendPolicy,
  type AISpendPeriod,
  type AISpendPolicy,
} from '@/lib/api/cms/ai-spend';

const keys = {
  all: ['ai-spend'] as const,
  status: () => [...keys.all, 'status'] as const,
  rollups: () => [...keys.all, 'rollups'] as const,
  runs: () => [...keys.all, 'runs'] as const,
};
export function useAISpendStatus(period: AISpendPeriod = {}) {
  return useQuery({
    queryKey: [...keys.status(), period],
    queryFn: () => getAISpendStatus(period),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}
export function useAISpendRollups(period: AISpendPeriod = {}, enabled = true) {
  return useQuery({
    enabled,
    queryKey: [...keys.rollups(), period],
    queryFn: () => getAISpendRollups(period),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}
export function useAISpendRuns(period: AISpendPeriod = {}, enabled = true) {
  return useQuery({
    enabled,
    queryKey: [...keys.runs(), period],
    queryFn: () => getAISpendRuns(period),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}
export function useRunAISpendGovernor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: runAISpendGovernor,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.all });
      toast({ title: 'Spend ledger updated', variant: 'success' });
    },
    onError: (e: Error) =>
      toast({
        title: 'Ledger run failed',
        description: e.message,
        variant: 'destructive',
      }),
  });
}
export function useUpdateAISpendPolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: Partial<AISpendPolicy>) => updateAISpendPolicy(p),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
}
