import { useCallback, useEffect, useState } from 'react';
import type { SystemIssue } from '@/types/platform/system-health';

const CHANGE_EVENT = 'system-health:issues-changed';
const STORAGE_KEY = 'system-health.dismissed-issues';
const DISMISS_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

type DismissMap = Record<string, number>; // key -> expiresAt epoch ms

export function issueKey(issue: SystemIssue): string {
  return `${issue.severity}:${issue.service ?? 'global'}:${issue.message}`;
}

function readStore(): DismissMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as DismissMap;
    const now = Date.now();
    let mutated = false;
    for (const [k, exp] of Object.entries(parsed)) {
      if (exp <= now) {
        delete parsed[k];
        mutated = true;
      }
    }
    if (mutated)
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    return parsed;
  } catch {
    return {};
  }
}

function writeStore(map: DismissMap) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // ignore quota / disabled storage
  }
}

export function useDismissedIssues() {
  const [map, setMap] = useState<DismissMap>({});

  useEffect(() => {
    const sync = () => setMap(readStore());
    sync();
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const dismiss = useCallback((issue: SystemIssue) => {
    const next = {
      ...readStore(),
      [issueKey(issue)]: Date.now() + DISMISS_TTL_MS,
    };
    writeStore(next);
    setMap(next);
  }, []);

  const clearAll = useCallback(() => {
    writeStore({});
    setMap({});
  }, []);

  const isDismissed = useCallback(
    (issue: SystemIssue) => {
      const exp = map[issueKey(issue)];
      return typeof exp === 'number' && exp > Date.now();
    },
    [map]
  );

  return { isDismissed, dismiss, clearAll };
}
