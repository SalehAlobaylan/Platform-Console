'use client';

import { create } from 'zustand';
import { z } from 'zod';
import { operatorVisibleContextSchema } from '@/lib/operator/schemas';
import type {
  OperatorIntent,
  OperatorVisibleContext,
} from '@/types/platform/operator';

export const OPERATOR_PATH = '/platform/operator';
const storageKey = 'wahb-workspace-session/v1';
const limit = 30;
// Open and recently closed chats may also retain their legacy server-ID alias.
const draftLimit = 100;

// Locations are navigation hints only. Never admit an external URL or API route.
export function workspaceHref(value: string, operator: boolean): boolean {
  try {
    if (
      !value.startsWith('/') ||
      value.length > 8000 ||
      /[\\\u0000-\u001f\u007f]/.test(value)
    )
      return false;
    const url = new URL(value, 'https://console.invalid');
    const rawPath = value.split(/[?#]/, 1)[0];
    const path = decodeURIComponent(rawPath);
    if (
      url.origin !== 'https://console.invalid' ||
      url.pathname !== rawPath ||
      path.includes('//') ||
      /[\\\u0000-\u001f\u007f]/.test(path) ||
      path.split('/').some((part) => part === '.' || part === '..')
    )
      return false;
    return operator
      ? path === OPERATOR_PATH
      : path !== OPERATOR_PATH &&
          (path === '/' ||
            path.startsWith('/platform/') ||
            path === '/admin' ||
            path.startsWith('/admin/'));
  } catch {
    return false;
  }
}

export type OperatorDraftSnapshot = {
  prompt: string;
  context: OperatorVisibleContext;
  intent: OperatorIntent;
  scroll: number;
  follow: boolean;
  threadID?: string;
  locale?: 'en' | 'ar';
};
export type OperatorTab = {
  id: string;
  threadID?: string;
  href: string;
  title: string;
};
export type OperatorPendingQuestion = {
  text: string;
  at: string;
  owner: string;
  investigationID?: string;
  state?: string;
};
export type OperatorTabRequest = {
  saving?: boolean;
  pending?: OperatorPendingQuestion;
  error?: string;
  budgetRequired?: boolean;
};
const tabSchema = z
  .object({
    id: z.string().uuid(),
    threadID: z.string().uuid().optional(),
    href: z.string().refine((value) => workspaceHref(value, true)),
    title: z.string().max(240),
  })
  .strict();
const draftSchema = z
  .object({
    prompt: z.string().max(8000),
    context: operatorVisibleContextSchema,
    intent: z.enum([
      'explain',
      'investigate',
      'compare',
      'recommend',
      'resolve',
    ]),
    scroll: z.number().finite().nonnegative(),
    follow: z.boolean(),
    threadID: z.string().uuid().optional(),
    locale: z.enum(['en', 'ar']).optional(),
  })
  .strict();
const snapshotSchema = z
  .object({
    owner: z.string(),
    consoleHref: z.string().refine((value) => workspaceHref(value, false)),
    operatorHref: z.string().refine((value) => workspaceHref(value, true)),
    consoleScroll: z.record(z.number().finite().nonnegative()),
    drafts: z.record(draftSchema),
    locale: z.enum(['en', 'ar']),
    operatorTabs: z.array(tabSchema).max(limit).default([]),
    closedOperatorTabs: z.array(tabSchema).max(10).default([]),
  })
  .strict();
function bounded<T>(values: Record<string, T>, size = limit) {
  return Object.fromEntries(Object.entries(values).slice(-size));
}
const defaults = () => ({
  consoleHref: '/',
  operatorHref: OPERATOR_PATH,
  consoleScroll: {} as Record<string, number>,
  drafts: {} as Record<string, OperatorDraftSnapshot>,
  locale: 'en' as 'en' | 'ar',
  operatorTabs: [] as OperatorTab[],
  closedOperatorTabs: [] as OperatorTab[],
  operatorRequests: {} as Record<string, OperatorTabRequest>,
});

type WorkspaceSession = ReturnType<typeof defaults> & {
  owner?: string;
  focusAfterSwitch?: 'console' | 'operator';
  setOwner: (owner?: string) => void;
  visit: (href: string) => void;
  saveConsoleScroll: (href: string, scroll: number) => void;
  saveDrafts: (drafts: Record<string, OperatorDraftSnapshot>) => void;
  setLocale: (locale: 'en' | 'ar') => void;
  openOperatorTab: (tab: OperatorTab) => OperatorTab | undefined;
  updateOperatorTab: (
    id: string,
    patch: Partial<Omit<OperatorTab, 'id'>>
  ) => void;
  closeOperatorTab: (id: string) => void;
  reopenOperatorTab: () => OperatorTab | undefined;
  forgetOperatorThread: (threadID: string) => void;
  setOperatorRequest: (
    id: string,
    patch: OperatorTabRequest,
    owner?: string
  ) => void;
  beginOperatorRequest: (
    id: string,
    pending: OperatorPendingQuestion,
    owner?: string
  ) => boolean;
};
export const useWorkspaceSession = create<WorkspaceSession>((set, get) => {
  const save = () => {
    const {
      owner,
      consoleHref,
      operatorHref,
      consoleScroll,
      drafts,
      locale,
      operatorTabs,
      closedOperatorTabs,
    } = get();
    if (!owner || typeof window === 'undefined') return;
    try {
      sessionStorage.setItem(
        storageKey,
        JSON.stringify({
          owner,
          consoleHref,
          operatorHref,
          consoleScroll,
          drafts,
          locale,
          operatorTabs,
          closedOperatorTabs,
        })
      );
    } catch {}
  };
  return {
    ...defaults(),
    setOwner: (owner) => {
      if (!owner) {
        try {
          sessionStorage.removeItem(storageKey);
        } catch {}
      }
      if (get().owner === owner) return;
      let restored;
      try {
        const raw = owner ? sessionStorage.getItem(storageKey) : null;
        const parsed =
          raw && raw.length < 1_000_000
            ? snapshotSchema.safeParse(JSON.parse(raw))
            : undefined;
        if (parsed?.success && parsed.data.owner === owner)
          restored = parsed.data;
        if (!restored) sessionStorage.removeItem(storageKey);
      } catch {}
      set({
        ...defaults(),
        ...restored,
        owner,
        focusAfterSwitch: undefined,
        drafts: bounded(restored?.drafts ?? {}, draftLimit),
        consoleScroll: bounded(restored?.consoleScroll ?? {}),
      });
    },
    visit: (href) => {
      const operator = workspaceHref(href, true);
      if (!operator && !workspaceHref(href, false)) return;
      const key = operator ? 'operatorHref' : 'consoleHref';
      if (get()[key] === href) return;
      set({ [key]: href });
      save();
    },
    saveConsoleScroll: (href, scroll) => {
      if (!workspaceHref(href, false) || !Number.isFinite(scroll) || scroll < 0)
        return;
      set({
        consoleScroll: bounded({ ...get().consoleScroll, [href]: scroll }),
      });
      save();
    },
    saveDrafts: (drafts) => {
      set({ drafts: bounded({ ...get().drafts, ...drafts }, draftLimit) });
      save();
    },
    setLocale: (locale) => {
      set({ locale });
      save();
    },
    openOperatorTab: (tab) => {
      const existing = get().operatorTabs.find(
        (item) =>
          item.id === tab.id ||
          Boolean(tab.threadID && item.threadID === tab.threadID)
      );
      if (existing) return existing;
      if (
        get().operatorTabs.length >= limit ||
        !tabSchema.safeParse(tab).success
      )
        return;
      set({
        operatorTabs: [...get().operatorTabs, tab],
        closedOperatorTabs: get().closedOperatorTabs.filter(
          (item) =>
            item.id !== tab.id &&
            (!tab.threadID || item.threadID !== tab.threadID)
        ),
      });
      save();
      return tab;
    },
    updateOperatorTab: (id, patch) => {
      if (patch.href && !workspaceHref(patch.href, true)) return;
      const previous = [
        ...get().operatorTabs,
        ...get().closedOperatorTabs,
      ].find((tab) => tab.id === id);
      if (
        !previous ||
        Object.entries(patch).every(
          ([key, value]) => previous[key as keyof OperatorTab] === value
        )
      )
        return;
      const updated = { ...previous, ...patch };
      if (!tabSchema.safeParse(updated).success) return;
      set({
        operatorTabs: get().operatorTabs.map((tab) =>
          tab.id === id ? updated : tab
        ),
        closedOperatorTabs: get().closedOperatorTabs.map((tab) =>
          tab.id === id ? updated : tab
        ),
        ...(patch.href && get().operatorHref === previous.href
          ? { operatorHref: patch.href }
          : {}),
      });
      save();
    },
    closeOperatorTab: (id) => {
      const tab = get().operatorTabs.find((item) => item.id === id);
      if (!tab) return;
      set({
        operatorTabs: get().operatorTabs.filter((item) => item.id !== id),
        closedOperatorTabs: [
          ...get().closedOperatorTabs.filter((item) => item.id !== id),
          tab,
        ].slice(-10),
      });
      save();
    },
    reopenOperatorTab: () => {
      const tab = get().closedOperatorTabs.at(-1);
      return tab ? get().openOperatorTab(tab) : undefined;
    },
    forgetOperatorThread: (threadID) => {
      const ids = [...get().operatorTabs, ...get().closedOperatorTabs]
        .filter((tab) => tab.threadID === threadID)
        .map((tab) => tab.id);
      const drafts = { ...get().drafts };
      const requests = { ...get().operatorRequests };
      for (const id of [...ids, threadID]) delete drafts[id];
      for (const id of ids) delete requests[id];
      set({
        drafts,
        operatorRequests: requests,
        operatorTabs: get().operatorTabs.filter(
          (tab) => tab.threadID !== threadID
        ),
        closedOperatorTabs: get().closedOperatorTabs.filter(
          (tab) => tab.threadID !== threadID
        ),
      });
      save();
    },
    setOperatorRequest: (id, patch, owner) => {
      if (get().owner !== owner) return;
      set({
        operatorRequests: {
          ...get().operatorRequests,
          [id]: { ...get().operatorRequests[id], ...patch },
        },
      });
    },
    beginOperatorRequest: (id, pending, owner) => {
      if (get().owner !== owner || get().operatorRequests[id]?.saving)
        return false;
      get().setOperatorRequest(
        id,
        { saving: true, pending, error: '', budgetRequired: false },
        owner
      );
      return true;
    },
  };
});

export function rememberConsoleLocation() {
  if (typeof window === 'undefined') return;
  const href =
    window.location.pathname + window.location.search + window.location.hash;
  if (!workspaceHref(href, false)) return;
  const state = useWorkspaceSession.getState();
  state.visit(href);
  const scroll = document.getElementById('console-scroll-region');
  if (scroll) state.saveConsoleScroll(href, scroll.scrollTop);
}
