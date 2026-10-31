import { useWorkspaceSession, workspaceHref } from '../workspace-session';

const context = {
  schema_version: 'wahb-operator/v1' as const,
  domain: 'storage_quality',
  view: 'storage',
  filters: {},
  subjects: [],
  available_intents: ['explain' as const],
};
beforeEach(() => {
  sessionStorage.clear();
  useWorkspaceSession.setState({
    owner: undefined,
    operatorTabs: [],
    closedOperatorTabs: [],
    operatorRequests: {},
    consoleHref: '/',
    operatorHref: '/platform/operator',
    consoleScroll: {},
    drafts: {},
    locale: 'en',
  });
});

it('restores tab-local routes, drafts and reading positions for the same authenticated owner', () => {
  const store = useWorkspaceSession.getState();
  store.setOwner('runtime:tenant:user');
  store.visit('/platform/storage?tab=quality#policy');
  store.saveConsoleScroll('/platform/storage?tab=quality#policy', 450);
  store.visit('/platform/operator?thread=chat&panel=evidence');
  store.saveDrafts({
    chat: {
      prompt: 'Keep this question',
      context,
      intent: 'explain',
      scroll: 200,
      follow: false,
    },
  });
  store.setLocale('ar');
  // A fresh JS store, with the same browser tab storage intact.
  useWorkspaceSession.setState({
    owner: undefined,
    operatorTabs: [],
    closedOperatorTabs: [],
    operatorRequests: {},
    consoleHref: '/',
    drafts: {},
  });
  store.setOwner('runtime:tenant:user');
  expect(useWorkspaceSession.getState()).toEqual(
    expect.objectContaining({
      consoleHref: '/platform/storage?tab=quality#policy',
      operatorHref: '/platform/operator?thread=chat&panel=evidence',
      locale: 'ar',
      consoleScroll: { '/platform/storage?tab=quality#policy': 450 },
      drafts: {
        chat: expect.objectContaining({
          prompt: 'Keep this question',
          scroll: 200,
          follow: false,
        }),
      },
    })
  );
});

it.each([
  'runtime:tenant:another-user',
  'runtime:another-tenant:user',
  'another-runtime:tenant:user',
  undefined,
])('clears continuity when owner changes to %s', (owner) => {
  const store = useWorkspaceSession.getState();
  store.setOwner('runtime:tenant:user');
  store.visit('/platform/storage');
  store.saveDrafts({
    new: {
      prompt: 'Private draft',
      context,
      intent: 'explain',
      scroll: 0,
      follow: true,
    },
  });
  store.setOwner(owner);
  expect(useWorkspaceSession.getState()).toEqual(
    expect.objectContaining({
      consoleHref: '/',
      operatorHref: '/platform/operator',
      drafts: {},
      consoleScroll: {},
    })
  );
  expect(sessionStorage.getItem('wahb-workspace-session/v1')).toBeNull();
});

it('ignores unsafe destinations and malformed saved snapshots', () => {
  const store = useWorkspaceSession.getState();
  for (const value of [
    '//evil.example',
    'https://evil.example',
    '/api/auth/logout',
    '/platform/../login',
    '/platform/%2f%2fevil',
    '/platform/%5cfoo',
    '/platform/%00foo',
  ]) {
    expect(workspaceHref(value, false)).toBe(false);
    store.visit(value);
  }
  expect(store.consoleHref).toBe('/');
  sessionStorage.setItem('wahb-workspace-session/v1', '{broken');
  store.setOwner('owner');
  expect(useWorkspaceSession.getState().drafts).toEqual({});
  expect(workspaceHref('/admin/users?page=2', false)).toBe(true);
  expect(workspaceHref('/platform/operator?thread=one', false)).toBe(false);
});

const tabA = {
  id: '00000000-0000-4000-8000-000000000001',
  href: '/platform/operator?draft=00000000-0000-4000-8000-000000000001',
  title: 'First draft',
};
const tabB = {
  id: '00000000-0000-4000-8000-000000000002',
  href: '/platform/operator?draft=00000000-0000-4000-8000-000000000002',
  title: 'Second draft',
};

it('persists separate open/closed drafts without persisting pending requests or paid approval', () => {
  const store = useWorkspaceSession.getState();
  store.setOwner('owner');
  store.openOperatorTab(tabA);
  store.openOperatorTab(tabB);
  store.saveDrafts({
    [tabA.id]: {
      prompt: 'A',
      context,
      intent: 'explain',
      scroll: 40,
      follow: false,
      locale: 'ar',
    },
    [tabB.id]: {
      prompt: 'B',
      context,
      intent: 'explain',
      scroll: 70,
      follow: true,
    },
  });
  expect(
    store.beginOperatorRequest(
      tabA.id,
      { text: 'A', at: 'now', owner: tabA.id },
      'owner'
    )
  ).toBe(true);
  expect(
    store.beginOperatorRequest(
      tabA.id,
      { text: 'duplicate', at: 'now', owner: tabA.id },
      'owner'
    )
  ).toBe(false);
  expect(
    store.beginOperatorRequest(
      tabB.id,
      { text: 'B', at: 'now', owner: tabB.id },
      'owner'
    )
  ).toBe(true);
  store.closeOperatorTab(tabA.id);
  const stored = JSON.parse(
    sessionStorage.getItem('wahb-workspace-session/v1')!
  );
  expect(stored.operatorRequests).toBeUndefined();
  useWorkspaceSession.setState({
    owner: undefined,
    operatorTabs: [],
    closedOperatorTabs: [],
    drafts: {},
    operatorRequests: {},
  });
  store.setOwner('owner');
  expect(useWorkspaceSession.getState().operatorTabs).toEqual([tabB]);
  expect(useWorkspaceSession.getState().closedOperatorTabs).toEqual([tabA]);
  expect(useWorkspaceSession.getState().operatorRequests).toEqual({});
  expect(useWorkspaceSession.getState().drafts[tabA.id]).toEqual(
    expect.objectContaining({ prompt: 'A', scroll: 40, locale: 'ar' })
  );
  expect(store.reopenOperatorTab()).toEqual(tabA);
  expect(store.openOperatorTab(tabA)).toEqual(tabA);
  expect(useWorkspaceSession.getState().operatorTabs).toHaveLength(2);
});

it('updates a closed tab without reopening it or changing the active destination', () => {
  const store = useWorkspaceSession.getState();
  store.setOwner('owner');
  store.openOperatorTab(tabA);
  store.openOperatorTab(tabB);
  store.visit(tabB.href);
  store.closeOperatorTab(tabA.id);
  store.updateOperatorTab(tabA.id, {
    threadID: tabA.id,
    href: '/platform/operator?thread=' + tabA.id,
  });
  expect(useWorkspaceSession.getState().operatorTabs).toEqual([tabB]);
  expect(useWorkspaceSession.getState().operatorHref).toBe(tabB.href);
  expect(store.reopenOperatorTab()?.href).toContain('thread=');
  expect(store.openOperatorTab({ ...tabB, threadID: tabA.id })).toEqual(tabB);
  store.setOperatorRequest(
    tabA.id,
    { error: 'stale error' },
    'different-owner'
  );
  expect(useWorkspaceSession.getState().operatorRequests).toEqual({});
});
