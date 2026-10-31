import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { cmsClient } from '@/lib/api/client';
import {
  useOperatorControls,
  useOperatorEvidence,
  useOperatorMutations,
  useOperatorTasks,
  useOperatorThreads,
  useOperatorThread,
  useOperatorTabSummaries,
} from '../use-operator';

jest.mock('@/lib/api/client', () => ({
  cmsClient: { post: jest.fn(), get: jest.fn() },
}));
const id = '00000000-0000-4000-8000-000000000001';
const at = '2026-10-30T12:00:00Z';

function setup() {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  // Reproduce a slow background read without making question submission wait.
  const invalidate = jest
    .spyOn(client, 'invalidateQueries')
    .mockReturnValue(new Promise<void>(() => {}));
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const view = renderHook(() => useOperatorMutations(), { wrapper });
  return { client, invalidate, view };
}

afterEach(() => jest.clearAllMocks());

it('does not request hidden sidebar data and fetches it when opened', async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  jest.mocked(cmsClient.get).mockImplementation(async (path) =>
    path === '/admin/operator/controls'
      ? {
          operational: true,
          controls: {
            read_enabled: true,
            llm_enabled: true,
            execution_enabled: true,
            schedules_enabled: true,
          },
        }
      : path.endsWith('/evidence')
        ? { items: [] }
        : { items: [], next_cursor: '' }
  );
  const view = renderHook(
    ({ enabled }) => ({
      controls: useOperatorControls(enabled),
      chats: useOperatorThreads({ archived: false }, enabled),
      tasks: useOperatorTasks({ group: 'active', kind: 'all' }, enabled),
      evidence: useOperatorEvidence(id, enabled),
    }),
    { wrapper, initialProps: { enabled: false } }
  );
  expect(cmsClient.get).not.toHaveBeenCalled();
  view.rerender({ enabled: true });
  await waitFor(() => expect(cmsClient.get).toHaveBeenCalledTimes(4));
  await waitFor(() =>
    expect(
      Object.values(view.result.current).every((query) => query.isSuccess)
    ).toBe(true)
  );
  expect(jest.mocked(cmsClient.get).mock.calls.map(([path]) => path)).toEqual(
    expect.arrayContaining([
      '/admin/operator/controls',
      '/admin/operator/threads',
      '/admin/operator/tasks',
      `/admin/operator/investigations/${id}/evidence`,
    ])
  );
  view.unmount();
  client.clear();
});

it('returns the created case without awaiting an unrelated briefing refresh', async () => {
  jest.mocked(cmsClient.post).mockResolvedValue({
    id,
    title: 'hello?',
    locale: 'en',
    last_activity_at: at,
    expires_at: at,
    created_at: at,
  });
  const { client, invalidate, view } = setup();
  let result: unknown;
  act(() => {
    void view.result.current.createThread
      .mutateAsync({ title: 'hello?', locale: 'en' })
      .then((value) => {
        result = value;
      });
  });
  await waitFor(() => expect(result).toEqual(expect.objectContaining({ id })));
  expect(invalidate).not.toHaveBeenCalledWith({ queryKey: ['operator'] });
  expect(invalidate).toHaveBeenCalledWith({
    queryKey: ['operator', 'threads'],
  });
  view.unmount();
  client.clear();
});

it('returns accepted work while case and task indexes refresh in the background', async () => {
  jest
    .mocked(cmsClient.post)
    .mockResolvedValue({ investigation_id: id, state: 'backgrounded' });
  const { client, invalidate, view } = setup();
  let result: unknown;
  act(() => {
    void view.result.current.startInvestigation
      .mutateAsync({
        visible_context: {
          schema_version: 'wahb-operator/v1',
          domain: 'media_circulation',
          view: 'cockpit',
          filters: {},
          subjects: [],
          available_intents: ['investigate'],
        },
        intent: 'investigate',
        locale: 'en',
        message: 'hello?',
        tier: 'fast',
        thread_id: id,
      })
      .then((value) => {
        result = value;
      });
  });
  await waitFor(() =>
    expect(result).toEqual({ investigation_id: id, state: 'backgrounded' })
  );
  expect(invalidate).not.toHaveBeenCalledWith({ queryKey: ['operator'] });
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['operator', 'tasks'] });
  view.unmount();
  client.clear();
});

it('shares one bounded status query for open chats without loading transcripts or acknowledging reads', async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  jest.mocked(cmsClient.get).mockResolvedValue({
    items: [
      {
        id,
        title: 'Chat',
        locale: 'en',
        created_at: at,
        last_activity_at: at,
        expires_at: at,
        activity_state: 'working',
        active_investigation_count: 1,
        unread_count: 0,
      },
    ],
    next_cursor: '',
  });
  const view = renderHook(
    ({ ids }) => [
      useOperatorTabSummaries(ids),
      useOperatorTabSummaries([...ids].reverse()),
    ],
    { wrapper, initialProps: { ids: [] as string[] } }
  );
  expect(cmsClient.get).not.toHaveBeenCalled();
  view.rerender({ ids: [id, id] });
  await waitFor(() =>
    expect(view.result.current.every((query) => query.isSuccess)).toBe(true)
  );
  expect(cmsClient.get).toHaveBeenCalledTimes(1);
  expect(cmsClient.get).toHaveBeenCalledWith(
    '/admin/operator/threads',
    { ids: id },
    expect.any(AbortSignal)
  );
  expect(cmsClient.post).not.toHaveBeenCalled();
  view.unmount();
  client.clear();
});

it('acknowledges only an explicitly displayed investigation and refreshes the shared summaries', async () => {
  jest.mocked(cmsClient.post).mockResolvedValue({});
  const { client, invalidate, view } = setup();
  await act(async () => {
    await view.result.current.markInvestigationRead.mutateAsync(id);
  });
  expect(cmsClient.post).toHaveBeenCalledWith(
    '/admin/operator/investigations/' + id + '/read'
  );
  expect(invalidate).toHaveBeenCalledWith({
    queryKey: ['operator', 'tab-summaries'],
  });
  view.unmount();
  client.clear();
});

it('rejects a history-only response rather than presenting unmeasured activity as idle', async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  jest.mocked(cmsClient.get).mockResolvedValue({
    items: [
      {
        id,
        title: 'Old history response',
        locale: 'en',
        created_at: at,
        last_activity_at: at,
        expires_at: at,
      },
    ],
    next_cursor: '',
  });
  const view = renderHook(() => useOperatorTabSummaries([id]), { wrapper });
  await waitFor(() => expect(view.result.current.isError).toBe(true));
  view.unmount();
  client.clear();
});

it('loads earlier messages without losing the newest or duplicating a focused answer', async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const thread = {
    id,
    title: 'History',
    locale: 'en',
    created_at: at,
    last_activity_at: at,
    expires_at: at,
  };
  const old = {
    id: '00000000-0000-4000-8000-000000000002',
    kind: 'message',
    actor_type: 'admin',
    created_at: '2026-10-30T11:00:00Z',
    content: { text: 'Earlier question' },
  };
  const recent = {
    ...old,
    id: '00000000-0000-4000-8000-000000000003',
    created_at: at,
    content: { text: 'Newest question' },
  };
  jest
    .mocked(cmsClient.get)
    .mockImplementation(async (_, params) =>
      (params as Record<string, unknown> | undefined)?.before
        ? { thread, messages: [old], older_cursor: '' }
        : { thread, messages: [old, recent], older_cursor: 'older' }
    );
  const view = renderHook(() => useOperatorThread(id, id), { wrapper });
  await waitFor(() => expect(view.result.current.isSuccess).toBe(true));
  expect(view.result.current.hasNextPage).toBe(true);
  await act(async () => {
    await view.result.current.fetchNextPage();
  });
  expect(
    view.result.current.data?.messages.map((message) => message.id)
  ).toEqual([old.id, recent.id]);
  await waitFor(() => expect(view.result.current.hasNextPage).toBe(false));
  expect(cmsClient.get).toHaveBeenCalledWith(
    '/admin/operator/threads/' + id,
    { focus: id },
    expect.any(AbortSignal)
  );
  expect(cmsClient.get).toHaveBeenCalledWith(
    '/admin/operator/threads/' + id,
    { before: 'older' },
    expect.any(AbortSignal)
  );
  view.unmount();
  client.clear();
});

it('separates chat-scoped activity from all-work reads and exposes pagination', async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  jest.mocked(cmsClient.get).mockImplementation(async (_, params) => ({
    items: [],
    next_cursor: (params as Record<string, unknown> | undefined)?.cursor
      ? ''
      : 'next',
  }));
  const view = renderHook(
    ({ threadID }: { threadID: string | undefined }) =>
      useOperatorTasks({
        group: 'all',
        kind: 'all',
        ...(threadID ? { threadID } : {}),
      }),
    { wrapper, initialProps: { threadID: id as string | undefined } }
  );
  await waitFor(() => expect(view.result.current.isSuccess).toBe(true));
  await act(async () => {
    await view.result.current.fetchNextPage();
  });
  expect(cmsClient.get).toHaveBeenCalledWith(
    '/admin/operator/tasks',
    { group: 'all', kind: 'all', thread_id: id, limit: 50, cursor: 'next' },
    expect.any(AbortSignal)
  );
  view.rerender({ threadID: undefined });
  await waitFor(() => expect(view.result.current.isSuccess).toBe(true));
  expect(jest.mocked(cmsClient.get).mock.calls.at(-1)?.[1]).toEqual({
    group: 'all',
    kind: 'all',
    limit: 50,
  });
  view.unmount();
  client.clear();
});
