import { act, renderHook } from '@testing-library/react';
import { useOpsClock } from '../use-operations-command-center';
import { opsSnapshotFresh } from '@/components/platform/operations/presentation';

it('accepts a fresh preview received between clock ticks and ages it without a fetch', () => {
  jest.useFakeTimers();
  try {
    const start = Date.parse('2026-10-30T12:00:00Z');
    jest.setSystemTime(start);
    const view = renderHook(() => useOpsClock());
    jest.setSystemTime(start + 6_000);
    view.rerender();
    const received = new Date(start + 6_000).toISOString();
    expect(opsSnapshotFresh(received, view.result.current)).toBe(true);
    act(() => jest.advanceTimersByTime(100_000));
    expect(opsSnapshotFresh(received, view.result.current)).toBe(false);
    view.unmount();
  } finally {
    jest.useRealTimers();
  }
});
