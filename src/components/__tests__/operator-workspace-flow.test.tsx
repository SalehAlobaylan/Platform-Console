import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { OperatorWorkspace } from '@/components/platform/operator/operator-workspace';
import {
  OperatorComposer,
  OperatorTranscript,
  OperatorBriefingPanel,
  OperatorPlanPanel,
  OperatorWorkspacePanel,
} from '@/components/platform/operator/operator-workspace-components';
import * as hooks from '@/hooks/use-operator';
import { useWorkspaceSession } from '@/lib/stores/workspace-session';
import { persistOperatorLaunchContext } from '@/lib/operator/launch-context';
import { randomUUID } from 'node:crypto';

let mockSearch = 'domain=media_circulation&view=cockpit';
const replace = jest.fn((href: string) => {
  mockSearch = href.split('?')[1] ?? '';
});
const invalidate = jest.fn().mockResolvedValue(undefined);
const caseID = '00000000-0000-4000-8000-000000000001';
const investigationID = '00000000-0000-4000-8000-000000000002';
jest.mock('@/lib/console-auth-capabilities', () => ({ useConsoleAuthCapabilities: () => undefined }));

jest.mock('@/lib/navigation', () => ({
  usePathname: () => '/platform/operator',
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams(mockSearch),
}));
jest.mock('@/components/operator/operator-activity-badge', () => ({
  OperatorActivityBadge: () => null,
}));
jest.mock('@tanstack/react-query', () => ({
  ...jest.requireActual('@tanstack/react-query'),
  useQueryClient: () => ({ invalidateQueries: invalidate }),
}));
jest.mock('@/hooks/use-operator', () => ({
  ...jest.requireActual('@/hooks/use-operator'),
  useOperatorStatus: jest.fn(),
  useOperatorControls: jest.fn(),
  useOperatorThreads: jest.fn(),
  useOperatorThread: jest.fn(),
  useOperatorBriefing: jest.fn(),
  useOperatorTasks: jest.fn(),
  useOperatorTabSummaries: jest.fn(),
  useOperatorMutations: jest.fn(),
  useOperatorInvestigationEvents: jest.fn(),
  useOperatorEvidence: jest.fn(),
  useOperatorEligibleActions: jest.fn(),
  useOperatorRecommendations: jest.fn(),
  useOperatorPlan: jest.fn(),
  useOperatorPlanEvents: jest.fn(),
}));

function setupWorkspace(configure?: () => void) {
  const createThread = jest.fn().mockResolvedValue({ id: caseID });
  const startInvestigation = jest
    .fn()
    .mockRejectedValueOnce({
      code: 'ai_budget_confirmation_required',
      message: 'The current budget needs your confirmation.',
    })
    .mockResolvedValue({
      investigation_id: investigationID,
      state: 'backgrounded',
    });
  const query = {
    data: undefined,
    isLoading: false,
    isFetching: false,
    isError: false,
  };
  const controls = {
    read_enabled: true,
    llm_enabled: true,
    execution_enabled: true,
    schedules_enabled: true,
    adapters: [],
  };
  jest
    .mocked(hooks.useOperatorStatus)
    .mockReturnValue({ ...query, data: { controls } } as never);
  jest
    .mocked(hooks.useOperatorControls)
    .mockReturnValue({ ...query, data: { controls } } as never);
  for (const hook of [
    hooks.useOperatorThread,
    hooks.useOperatorBriefing,
    hooks.useOperatorInvestigationEvents,
    hooks.useOperatorPlan,
    hooks.useOperatorPlanEvents,
  ])
    jest.mocked(hook).mockReturnValue(query as never);
  for (const hook of [
    hooks.useOperatorThreads,
    hooks.useOperatorTasks,
    hooks.useOperatorTabSummaries,
    hooks.useOperatorEvidence,
    hooks.useOperatorEligibleActions,
    hooks.useOperatorRecommendations,
  ])
    jest
      .mocked(hook)
      .mockReturnValue({ ...query, data: { items: [] } } as never);
  jest.mocked(hooks.useOperatorMutations).mockReturnValue({
    approvePlan: { isPending: false },
    createThread: { isPending: false, mutateAsync: createThread },
    startInvestigation: { isPending: false, mutateAsync: startInvestigation },
  } as never);
  configure?.();
  const view = render(<OperatorWorkspace />);
  return { createThread, startInvestigation, view };
}

beforeEach(() => {
  Object.defineProperty(crypto, 'randomUUID', {
    value: randomUUID,
    configurable: true,
  });
  jest.clearAllMocks();
  useWorkspaceSession.setState({
    owner: undefined,
    operatorTabs: [],
    closedOperatorTabs: [],
    operatorRequests: {},
    drafts: {},
    locale: 'en',
    consoleHref: '/',
    operatorHref: '/platform/operator',
  });
  localStorage.clear();
  window.history.replaceState(null, '', '/platform/operator');
  window.matchMedia = jest.fn().mockImplementation((query: string) => ({
    matches: query === '(min-width: 1024px)',
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  }));
  mockSearch = 'domain=media_circulation&view=cockpit';
});

it('requires explicit paid confirmation and reuses the exact case and question', async () => {
  const { createThread, startInvestigation } = setupWorkspace();
  fireEvent.change(
    screen.getByRole('textbox', { name: /Ask what is happening/ }),
    { target: { value: 'What is blocked?' } }
  );
  fireEvent.click(screen.getByRole('button', { name: 'Send question' }));
  await screen.findByRole('dialog', { name: 'Continue above the AI budget?' });
  expect(startInvestigation).toHaveBeenCalledTimes(1);
  expect(startInvestigation.mock.calls[0][0].spend_acknowledged).toBe(false);
  fireEvent.click(
    screen.getByRole('button', { name: 'Continue with a paid answer' })
  );
  await waitFor(() => expect(startInvestigation).toHaveBeenCalledTimes(2));
  expect(createThread).toHaveBeenCalledTimes(1);
  expect(startInvestigation.mock.calls[1][0]).toEqual(
    expect.objectContaining({
      thread_id: caseID,
      message: 'What is blocked?',
      spend_acknowledged: true,
    })
  );
});

it('shows the CMS-resolved storage scope after asking from Operations', async () => {
  mockSearch = 'domain=global_ops&view=cockpit';
  const { startInvestigation } = setupWorkspace();
  startInvestigation.mockReset().mockResolvedValue({
    investigation_id: investigationID,
    state: 'backgrounded',
    visible_context: {
      schema_version: 'wahb-operator/v1',
      domain: 'storage_quality',
      view: 'storage',
      filters: {},
      subjects: [],
      available_intents: ['explain', 'investigate', 'resolve'],
    },
  });
  fireEvent.change(
    screen.getByRole('textbox', { name: /Ask what is happening/ }),
    { target: { value: 'what the status of the storage' } }
  );
  fireEvent.click(screen.getByRole('button', { name: 'Send question' }));
  await waitFor(() => expect(mockSearch).toContain('domain=storage_quality'));
  expect(startInvestigation.mock.calls[0][0].visible_context.domain).toBe(
    'global_ops'
  );
  expect(mockSearch).toContain('view=storage');
  expect(
    screen.getByRole('combobox', { name: /Working in/ })
  ).toHaveTextContent('Storage');
});

it('keeps a cancelled budget review editable and retries within the same case', async () => {
  const { createThread, startInvestigation } = setupWorkspace();
  const input = screen.getByRole('textbox', { name: /Ask what is happening/ });
  fireEvent.change(input, { target: { value: 'What is blocked?' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send question' }));
  await screen.findByRole('dialog');
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(input).toHaveValue('What is blocked?');
  expect(startInvestigation).toHaveBeenCalledTimes(1);
  fireEvent.change(input, {
    target: { value: 'Explain this status instead.' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Send question' }));
  await waitFor(() => expect(startInvestigation).toHaveBeenCalledTimes(2));
  expect(createThread).toHaveBeenCalledTimes(1);
  expect(startInvestigation.mock.calls[1][0]).toEqual(
    expect.objectContaining({
      thread_id: caseID,
      message: 'Explain this status instead.',
      spend_acknowledged: false,
    })
  );
});

it('submits Enter, preserves Shift+Enter and IME composition, and labels submission progress', () => {
  const submit = jest.fn((event) => event.preventDefault());
  const props = {
    locale: 'en' as const,
    prompt: 'hello?',
    intent: 'explain' as const,
    allowed: ['explain' as const],
    disabled: false,
    busy: false,
    onPrompt: jest.fn(),
    onIntent: jest.fn(),
    onSubmit: submit,
  };
  const { rerender } = render(<OperatorComposer {...props} />);
  const input = screen.getByRole('textbox');
  fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
  fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
  expect(submit).not.toHaveBeenCalled();
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(submit).toHaveBeenCalledTimes(1);
  rerender(<OperatorComposer {...props} busy />);
  expect(screen.getByRole('status')).toHaveTextContent('Saving your question');
  expect(
    screen.getByRole('combobox', { name: 'Response style' })
  ).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Send question' })).toBeDisabled();
});

it('offers review after failure without starting another investigation', () => {
  const review = jest.fn();
  render(
    <OperatorTranscript
      locale="en"
      messages={[]}
      investigationState="failed"
      investigationEvents={[]}
      actions={[]}
      recommendations={[]}
      onEvidence={jest.fn()}
      onPrepare={jest.fn()}
      onCancelInvestigation={jest.fn()}
      onRetry={review}
    />
  );
  expect(screen.getByRole('alert')).toHaveTextContent('Your question is saved');
  expect(review).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Review question' }));
  expect(review).toHaveBeenCalledTimes(1);
});

it('allows a starter question while the briefing loads', () => {
  const question = jest.fn();
  render(<OperatorBriefingPanel locale="en" loading onQuestion={question} />);
  fireEvent.click(
    screen.getByRole('button', { name: 'What needs my attention here?' })
  );
  expect(question).toHaveBeenCalledWith(
    'What needs my attention here?',
    'investigate'
  );
});

it('keeps the conversation and draft visible while inspecting sidebar activity', () => {
  const { view } = setupWorkspace();
  const input = screen.getByRole('textbox', { name: /Ask what is happening/ });
  fireEvent.change(input, {
    target: { value: 'Keep my draft while I check activity.' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Chat history' }));
  fireEvent.keyDown(screen.getByRole('button', { name: 'Chat options' }), {
    key: 'ArrowDown',
  });
  fireEvent.click(screen.getByRole('menuitem', { name: 'Activity' }));
  expect(mockSearch).toContain('panel=tasks');
  view.rerender(<OperatorWorkspace />);
  expect(screen.getByRole('region', { name: 'Activity' })).toBeVisible();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByRole('textbox')).toHaveValue(
    'Keep my draft while I check activity.'
  );
  expect(
    within(screen.getByRole('banner')).getByRole('tablist', {
      name: 'Open chats',
    })
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Close sidebar' }));
  view.rerender(<OperatorWorkspace />);
  expect(
    screen.getByRole('textbox', { name: /Ask what is happening/ })
  ).toHaveValue('Keep my draft while I check activity.');
});

it('opens legacy controls in the sidebar and plan deep links inline beside the composer', () => {
  mockSearch += '&inspector=governance';
  const { view } = setupWorkspace();
  expect(
    screen.getByRole('heading', { name: 'Operator status' })
  ).toBeVisible();
  expect(screen.getByText('AI interpretation')).toBeVisible();
  expect(screen.queryByText('adapters')).not.toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  mockSearch = 'domain=media_circulation&view=cockpit&plan=' + investigationID;
  view.rerender(<OperatorWorkspace />);
  expect(screen.getByRole('region', { name: 'Plan review' })).toBeVisible();
  expect(screen.getByRole('textbox')).toBeVisible();
  expect(
    screen.getByText('Select an eligible action to prepare a signed plan.')
  ).toBeVisible();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('opens evidence for the answer that was cited rather than the latest investigation', () => {
  const evidence = jest.fn();
  render(
    <OperatorTranscript
      locale="en"
      messages={[
        {
          id: caseID,
          kind: 'response',
          actor_type: 'operator',
          created_at: '2026-10-30T12:00:00Z',
          investigation_id: caseID,
          content: {
            blocks: [
              {
                kind: 'fact',
                text: 'Earlier finding',
                evidence_ids: ['earlier-proof'],
              },
            ],
          },
        },
        {
          id: investigationID,
          kind: 'response',
          actor_type: 'operator',
          created_at: '2026-10-30T12:01:00Z',
          investigation_id: investigationID,
          content: {
            blocks: [
              {
                kind: 'fact',
                text: 'Later finding',
                evidence_ids: ['later-proof'],
              },
            ],
          },
        },
      ]}
      investigationState="completed"
      investigationEvents={[]}
      actions={[]}
      recommendations={[]}
      onEvidence={evidence}
      onPrepare={jest.fn()}
      onCancelInvestigation={jest.fn()}
    />
  );
  const earlier = screen.getByText('Earlier finding').closest('section')!;
  fireEvent.click(
    within(earlier).getAllByRole('button', { name: /sources/i })[0]
  );
  expect(evidence).toHaveBeenCalledWith(caseID, ['earlier-proof']);
});

it('inspects an older citation without switching the active run or losing the draft', () => {
  mockSearch += `&thread=${caseID}&investigation=${investigationID}`;
  const { view } = setupWorkspace(() => {
    jest.mocked(hooks.useOperatorThread).mockReturnValue({
      data: {
        thread: { title: 'Storage review', locale: 'en' },
        messages: [caseID, investigationID].map((id, index) => ({
          id,
          actor_type: 'operator',
          investigation_id: id,
          created_at: `2026-10-30T12:0${index}:00Z`,
          content: {
            blocks: [
              {
                kind: 'fact',
                text: index ? 'Latest finding' : 'Older finding',
                evidence_ids: ['proof'],
              },
            ],
          },
        })),
      },
    } as never);
  });
  fireEvent.change(screen.getByRole('textbox'), {
    target: { value: 'Keep this follow-up' },
  });
  const earlier = screen.getByText('Older finding').closest('section')!;
  fireEvent.click(
    within(earlier).getAllByRole('button', { name: /sources/i })[0]
  );
  view.rerender(<OperatorWorkspace />);
  expect(new URLSearchParams(mockSearch).get('investigation')).toBe(
    investigationID
  );
  expect(new URLSearchParams(mockSearch).get('evidence_for')).toBe(caseID);
  expect(hooks.useOperatorInvestigationEvents).toHaveBeenLastCalledWith(
    investigationID
  );
  expect(hooks.useOperatorEvidence).toHaveBeenLastCalledWith(caseID, true);
  expect(screen.getByRole('textbox')).toHaveValue('Keep this follow-up');
});

it('changes only next-question scope while preserving the current chat and draft', () => {
  mockSearch += `&thread=${caseID}&investigation=${investigationID}`;
  const { view, startInvestigation } = setupWorkspace();
  fireEvent.change(screen.getByRole('textbox'), {
    target: { value: 'Next question' },
  });
  fireEvent.keyDown(screen.getByRole('combobox', { name: 'Working in' }), {
    key: 'ArrowDown',
  });
  const option = screen.getByRole('option', { name: 'Storage & Quality' });
  fireEvent.pointerDown(option);
  fireEvent.click(option);
  view.rerender(<OperatorWorkspace />);
  expect(new URLSearchParams(mockSearch).get('domain')).toBe('storage_quality');
  expect(new URLSearchParams(mockSearch).get('thread')).toBe(caseID);
  expect(new URLSearchParams(mockSearch).get('investigation')).toBe(
    investigationID
  );
  expect(screen.getByRole('textbox')).toHaveValue('Next question');
  expect(startInvestigation).not.toHaveBeenCalled();
});

it('restores each chat draft, response style, scope and reading position', () => {
  mockSearch += `&thread=${caseID}`;
  const { view } = setupWorkspace();
  fireEvent.change(screen.getByRole('textbox'), {
    target: { value: 'Draft in first chat' },
  });
  const log = screen.getByRole('log');
  Object.defineProperties(log, {
    scrollHeight: { configurable: true, value: 2000 },
    clientHeight: { configurable: true, value: 600 },
  });
  log.scrollTop = 300;
  fireEvent.scroll(log);
  mockSearch = `domain=storage_quality&view=storage&thread=${investigationID}&intent=investigate`;
  view.rerender(<OperatorWorkspace />);
  expect(screen.getByRole('textbox')).toHaveValue('');
  fireEvent.change(screen.getByRole('textbox'), {
    target: { value: 'Second chat draft' },
  });
  mockSearch = `domain=storage_quality&view=storage&thread=${caseID}&intent=investigate`;
  view.rerender(<OperatorWorkspace />);
  expect(screen.getByRole('textbox')).toHaveValue('Draft in first chat');
  expect(
    screen.getByRole('combobox', { name: 'Working in' })
  ).toHaveTextContent('Media Circulation');
  expect(new URLSearchParams(mockSearch).get('intent')).toBe('explain');
  expect(log.scrollTop).toBe(300);
  mockSearch = `domain=media_circulation&view=cockpit&thread=${investigationID}`;
  view.rerender(<OperatorWorkspace />);
  expect(screen.getByRole('textbox')).toHaveValue('Second chat draft');
  expect(
    screen.getByRole('combobox', { name: 'Working in' })
  ).toHaveTextContent('Storage');
});

it('loads supporting reads only for the visible sidebar section', () => {
  mockSearch += `&thread=${caseID}`;
  setupWorkspace();
  expect(hooks.useOperatorControls).toHaveBeenLastCalledWith(false);
  expect(hooks.useOperatorThreads).toHaveBeenLastCalledWith(
    expect.anything(),
    false
  );
  expect(hooks.useOperatorTasks).toHaveBeenLastCalledWith(
    expect.anything(),
    false
  );
  expect(hooks.useOperatorEvidence).toHaveBeenLastCalledWith(undefined, false);
  fireEvent.click(screen.getByRole('button', { name: 'Chat history' }));
  expect(hooks.useOperatorThreads).toHaveBeenLastCalledWith(
    expect.anything(),
    true
  );
  fireEvent.keyDown(screen.getByRole('button', { name: 'Chat options' }), {
    key: 'ArrowDown',
  });
  fireEvent.click(screen.getByRole('menuitem', { name: 'Operator status' }));
  expect(hooks.useOperatorControls).toHaveBeenLastCalledWith(true);
  expect(hooks.useOperatorThreads).toHaveBeenLastCalledWith(
    expect.anything(),
    false
  );
  fireEvent.keyDown(screen.getByRole('button', { name: 'Chat options' }), {
    key: 'ArrowDown',
  });
  fireEvent.click(screen.getByRole('menuitem', { name: 'Activity' }));
  expect(hooks.useOperatorTasks).toHaveBeenLastCalledWith(
    expect.anything(),
    true
  );
  expect(hooks.useOperatorControls).toHaveBeenLastCalledWith(false);
});

it('shows the local question as saving while awaiting CMS acknowledgement', async () => {
  const { createThread, startInvestigation } = setupWorkspace();
  let resolveThread!: (value: { id: string }) => void;
  createThread.mockImplementation(
    () =>
      new Promise((resolve) => {
        resolveThread = resolve;
      })
  );
  fireEvent.change(screen.getByRole('textbox'), {
    target: { value: 'Slow question' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Send question' }));
  expect(
    within(screen.getByRole('log')).getByText('Slow question')
  ).toBeVisible();
  expect(within(screen.getByRole('log')).getByRole('status')).toHaveTextContent(
    'Saving your question'
  );
  expect(startInvestigation).not.toHaveBeenCalled();
  await act(async () => resolveThread({ id: caseID }));
  await screen.findByRole('dialog', { name: 'Continue above the AI budget?' });
});

it('shows accepted progress before the saved chat read catches up', async () => {
  const { startInvestigation, view } = setupWorkspace();
  startInvestigation.mockReset().mockResolvedValue({
    investigation_id: investigationID,
    state: 'backgrounded',
  });
  fireEvent.change(screen.getByRole('textbox'), {
    target: { value: 'Accepted question' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Send question' }));
  await waitFor(() =>
    expect(mockSearch).toContain(`investigation=${investigationID}`)
  );
  view.rerender(<OperatorWorkspace />);
  expect(
    within(screen.getByRole('log')).getByText('Accepted question')
  ).toBeVisible();
  expect(
    within(screen.getByRole('log')).getByText(
      'Your question is saved. You can leave this page while work continues.'
    )
  ).toBeVisible();
  expect(screen.getByRole('textbox')).toHaveValue('');
});

it('restores an unsent draft, scope and reading position after leaving Operator', () => {
  const { view } = setupWorkspace();
  fireEvent.change(screen.getByRole('textbox'), {
    target: { value: 'Draft for the round trip' },
  });
  const log = screen.getByRole('log');
  Object.defineProperties(log, {
    scrollHeight: { configurable: true, value: 2000 },
    clientHeight: { configurable: true, value: 600 },
  });
  log.scrollTop = 280;
  fireEvent.scroll(log);
  fireEvent.click(screen.getByRole('button', { name: 'Attached context' }));
  view.unmount();
  render(<OperatorWorkspace />);
  expect(screen.getByRole('textbox')).toHaveValue('Draft for the round trip');
  expect(
    screen.getByRole('combobox', { name: 'Working in' })
  ).toHaveTextContent('Media Circulation');
  expect(screen.getByRole('log').scrollTop).toBe(280);
  expect(
    screen.getByRole('region', { name: 'Context for your next question' })
  ).toBeVisible();
});

it('attaches explicit page context on return while retaining the existing chat draft', () => {
  mockSearch += `&thread=${caseID}&investigation=${investigationID}`;
  const { view, createThread, startInvestigation } = setupWorkspace();
  fireEvent.change(screen.getByRole('textbox'), {
    target: { value: 'Keep this draft with the new page context' },
  });
  view.unmount();
  const context = {
    schema_version: 'wahb-operator/v1' as const,
    domain: 'storage_quality',
    view: 'storage',
    filters: { tab: 'quality' },
    subjects: [],
    available_intents: ['explain' as const],
  };
  persistOperatorLaunchContext(context);
  mockSearch = `domain=storage_quality&view=storage&thread=${caseID}&investigation=${investigationID}&panel=conversation`;
  render(<OperatorWorkspace />);
  expect(screen.getByRole('textbox')).toHaveValue(
    'Keep this draft with the new page context'
  );
  expect(
    screen.getByRole('combobox', { name: 'Working in' })
  ).toHaveTextContent('Storage');
  expect(createThread).not.toHaveBeenCalled();
  expect(startInvestigation).not.toHaveBeenCalled();
});

it('records a late acknowledgement without navigating away from Console', async () => {
  const { view, startInvestigation } = setupWorkspace();
  const originalTab = useWorkspaceSession.getState().operatorTabs[0].id;
  let accept!: (value: { investigation_id: string; state: string }) => void;
  startInvestigation.mockReset().mockImplementation(
    () =>
      new Promise((resolve) => {
        accept = resolve;
      })
  );
  act(() =>
    useWorkspaceSession.getState().visit('/platform/operator?' + mockSearch)
  );
  fireEvent.change(screen.getByRole('textbox'), {
    target: { value: 'Accept this after leaving' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Send question' }));
  await waitFor(() => expect(startInvestigation).toHaveBeenCalledTimes(1));
  view.unmount();
  const navigations = replace.mock.calls.length;
  await act(async () =>
    accept({ investigation_id: investigationID, state: 'backgrounded' })
  );
  expect(replace).toHaveBeenCalledTimes(navigations);
  expect(useWorkspaceSession.getState().operatorHref).toContain(
    `thread=${caseID}`
  );
  expect(useWorkspaceSession.getState().operatorHref).toContain(
    `investigation=${investigationID}`
  );
  expect(useWorkspaceSession.getState().drafts[originalTab].prompt).toBe('');
});

it('reuses an unsent case after returning from Console without remembering paid approval', async () => {
  const { view, createThread, startInvestigation } = setupWorkspace();
  fireEvent.change(screen.getByRole('textbox'), {
    target: { value: 'Question needing a paid review' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Send question' }));
  await screen.findByRole('dialog', { name: 'Continue above the AI budget?' });
  view.unmount();
  render(<OperatorWorkspace />);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByRole('textbox')).toHaveValue(
    'Question needing a paid review'
  );
  fireEvent.click(screen.getByRole('button', { name: 'Send question' }));
  await waitFor(() => expect(startInvestigation).toHaveBeenCalledTimes(2));
  expect(createThread).toHaveBeenCalledTimes(1);
  expect(startInvestigation.mock.calls[1][0]).toEqual(
    expect.objectContaining({ thread_id: caseID, spend_acknowledged: false })
  );
});

it('keeps the reading position when new events arrive until the reader requests the new reply', () => {
  mockSearch += `&thread=${caseID}&investigation=${investigationID}`;
  const { view } = setupWorkspace();
  const markRead = jest.fn().mockResolvedValue({});
  jest.mocked(hooks.useOperatorMutations).mockReturnValue({
    ...hooks.useOperatorMutations(),
    markInvestigationRead: { mutateAsync: markRead },
  } as never);
  const log = screen.getByRole('log');
  Object.defineProperties(log, {
    scrollHeight: { configurable: true, value: 2000 },
    clientHeight: { configurable: true, value: 600 },
  });
  log.scrollTop = 300;
  fireEvent.scroll(log);
  jest.mocked(hooks.useOperatorInvestigationEvents).mockReturnValue({
    data: { state: 'backgrounded', events: [], next_sequence: 2 },
  } as never);
  view.rerender(<OperatorWorkspace />);
  expect(log.scrollTop).toBe(300);
  jest.mocked(hooks.useOperatorInvestigationEvents).mockReturnValue({
    data: { state: 'completed', events: [], next_sequence: 3 },
  } as never);
  jest.mocked(hooks.useOperatorThread).mockReturnValue({
    data: {
      thread: { title: 'Completed chat', locale: 'en' },
      messages: [
        {
          id: investigationID,
          kind: 'response',
          actor_type: 'operator',
          created_at: '2026-10-30T12:00:00Z',
          investigation_id: investigationID,
          content: {
            blocks: [
              {
                kind: 'conclusion',
                text: 'Latest result',
                evidence_ids: ['one'],
              },
            ],
          },
        },
      ],
    },
  } as never);
  view.rerender(<OperatorWorkspace />);
  expect(markRead).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Jump to latest' }));
  expect(log.scrollTop).toBe(2000);
  expect(markRead).toHaveBeenCalledTimes(1);
  expect(markRead).toHaveBeenCalledWith(investigationID);
  expect(
    screen.queryByRole('button', { name: 'Jump to latest' })
  ).not.toBeInTheDocument();
});

it('keeps an unexecuted plan distinct from verified results and requires the approval confirmation', async () => {
  const approve = jest.fn();
  render(
    <OperatorPlanPanel
      locale="en"
      plan={
        {
          id: caseID,
          state: 'awaiting_approval',
          risk_tier: 'routine',
          localized_action_key: 'operator.action.media_sources_pause',
          digest: 'a'.repeat(64),
          affected_domains: ['media_sources'],
          canonical_plan: {
            target_ids: ['source-1'],
            cancellation: 'before_start_only',
            rollback: 'media_sources.resume',
            contingencies: [],
          },
          verified_effects: { before: null, after: null, verified: null },
        } as never
      }
      events={[]}
      stale={false}
      approving={false}
      onApprove={approve}
      onCancel={jest.fn()}
      onRefresh={jest.fn()}
    />
  );
  expect(
    screen.getByText('This plan has not run. Approval is required.')
  ).toBeVisible();
  expect(screen.getByText('Before the action starts')).toBeVisible();
  expect(screen.queryByText('Verified proof')).not.toBeInTheDocument();
  expect(screen.queryByText('null')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Approve plan' }));
  expect(approve).not.toHaveBeenCalled();
  const confirmation = screen.getByRole('dialog');
  await act(async () => {
    fireEvent.click(
      within(confirmation).getByRole('button', { name: 'Approve plan' })
    );
  });
  expect(approve).toHaveBeenCalledWith('APPROVE');
});

it('requires a fresh confirmation when a signed plan changes during review', () => {
  const approve = jest.fn();
  const plan: NonNullable<Parameters<typeof OperatorPlanPanel>[0]['plan']> = {
    id: caseID,
    state: 'awaiting_approval',
    tool_key: 'media_sources.pause',
    risk_tier: 'routine',
    expires_at: '2099-01-01T00:00:00Z',
    localized_action_key: 'operator.action.media_sources_pause',
    digest: 'a'.repeat(64),
    canonical_plan: {
      schema_version: 'wahb-operator/v1',
      plan_id: caseID,
      tenant_id: 'fixture-tenant',
      actor_id: 'fixture-operator',
      tool_key: 'media_sources.pause',
      tool_version: '1',
      target_ids: ['source-1'],
      normalized_arguments: {},
      evidence_ids: ['fixture-evidence'],
      evidence_fingerprint: 'fixture-fingerprint',
      access_version: '1',
      risk_tier: 'routine',
      cancellation: 'before_start_only',
      rollback: 'media_sources.resume',
      contingencies: ['Recheck source health'],
    },
  };
  const panel = (candidate: typeof plan) => (
    <OperatorPlanPanel locale="en" plan={candidate} events={[]} stale={false}
      approving={false} onApprove={approve} onCancel={jest.fn()} />
  );
  const view = render(panel(plan));
  fireEvent.click(screen.getByRole('button', { name: 'Approve plan' }));
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  view.rerender(panel({
    ...plan,
    digest: 'b'.repeat(64),
    canonical_plan: { ...plan.canonical_plan, target_ids: ['source-2'] },
  }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  view.rerender(panel(plan));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(approve).not.toHaveBeenCalled();
});

it('labels expired evidence as stale while preserving its collected status', () => {
  render(
    <OperatorWorkspacePanel
      locale="en"
      tab="evidence"
      context={{} as never}
      evidence={[
        {
          id: caseID,
          evidence_id: 'media_circulation_policy:tenant',
          domain: 'media_circulation',
          availability: 'available',
          authority: 'live',
          adapter_key: 'media_circulation.state',
          observed_at: '2026-01-01T12:00:00Z',
          expires_at: '2026-01-01T12:02:00Z',
          deep_link: '/platform/media/circulation',
        } as never,
      ]}
      tasks={[]}
      taskGroup="active"
      taskKind="all"
      planEvents={[]}
      planStale={false}
      approving={false}
      onTaskGroup={jest.fn()}
      onTaskKind={jest.fn()}
      onCancelTask={jest.fn()}
      onApprove={jest.fn()}
      onCancelPlan={jest.fn()}
      onRefreshPlan={jest.fn()}
    />
  );
  expect(screen.getByText('Stale')).toBeVisible();
  expect(screen.getByText('media circulation policy')).toBeVisible();
  expect(screen.getByText('Available')).not.toBeVisible();
});

it('withholds approval on expired previews without expiring completed proof', () => {
  const plan = {
    id: caseID,
    state: 'awaiting_approval',
    expires_at: '2026-01-01T00:00:00Z',
    risk_tier: 'routine',
    localized_action_key: 'operator.action.media_sources_pause',
    digest: 'a'.repeat(64),
    affected_domains: ['media_sources'],
    canonical_plan: {
      target_ids: ['source-1'],
      cancellation: 'before_start_only',
      rollback: 'media_sources.resume',
      contingencies: [],
    },
  };
  const props = {
    locale: 'en' as const,
    plan: plan as never,
    events: [],
    stale: false,
    approving: false,
    onApprove: jest.fn(),
    onCancel: jest.fn(),
  };
  const { rerender } = render(<OperatorPlanPanel {...props} />);
  expect(screen.getByText('Expired preview')).toBeVisible();
  expect(
    screen.queryByRole('button', { name: 'Approve plan' })
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Prepare fresh plan' })
  ).not.toBeInTheDocument();
  rerender(
    <OperatorPlanPanel
      {...props}
      plan={
        {
          ...plan,
          state: 'succeeded',
          verified_effects: { verified: true },
        } as never
      }
    />
  );
  expect(screen.getByRole('heading', { name: 'Verified proof' })).toBeVisible();
  expect(screen.queryByText('Expired preview')).not.toBeInTheDocument();
});

it('keeps two concurrent submissions and out-of-order acknowledgements with their own tabs', async () => {
  const { view, createThread, startInvestigation } = setupWorkspace();
  const secondCase = '00000000-0000-4000-8000-000000000003';
  const secondRun = '00000000-0000-4000-8000-000000000004';
  const accept: Array<(value: unknown) => void> = [];
  createThread
    .mockReset()
    .mockResolvedValueOnce({ id: caseID })
    .mockResolvedValueOnce({ id: secondCase });
  startInvestigation
    .mockReset()
    .mockImplementation(() => new Promise((resolve) => accept.push(resolve)));
  const firstTab = useWorkspaceSession.getState().operatorTabs[0].id;
  fireEvent.change(screen.getByRole('textbox'), {
    target: { value: 'First independent question' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Send question' }));
  await waitFor(() => expect(startInvestigation).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole('button', { name: 'New chat' }));
  view.rerender(<OperatorWorkspace />);
  const secondTab = useWorkspaceSession.getState().operatorTabs[1].id;
  expect(secondTab).not.toBe(firstTab);
  expect(screen.getByRole('textbox')).toHaveValue('');
  fireEvent.change(screen.getByRole('textbox'), {
    target: { value: 'Second independent question' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Send question' }));
  await waitFor(() => expect(startInvestigation).toHaveBeenCalledTimes(2));
  const secondURL = mockSearch;
  await act(async () =>
    accept[0]({ investigation_id: investigationID, state: 'backgrounded' })
  );
  expect(mockSearch).toBe(secondURL);
  expect(screen.getByRole('textbox')).toHaveValue(
    'Second independent question'
  );
  fireEvent.click(document.getElementById(`operator-tab-${firstTab}`)!);
  view.rerender(<OperatorWorkspace />);
  expect(screen.getByRole('textbox')).toHaveValue('');
  expect(new URLSearchParams(mockSearch).get('thread')).toBe(caseID);
  expect(screen.getByRole('button', { name: 'Send question' })).toBeDisabled();
  expect(screen.getByRole('textbox')).not.toBeDisabled();
  fireEvent.change(screen.getByRole('textbox'), {
    target: { value: 'Follow-up while first reply runs' },
  });
  const firstURL = mockSearch;
  await act(async () =>
    accept[1]({ investigation_id: secondRun, state: 'backgrounded' })
  );
  expect(mockSearch).toBe(firstURL);
  expect(screen.getByRole('textbox')).toHaveValue(
    'Follow-up while first reply runs'
  );
  fireEvent.click(document.getElementById(`operator-tab-${secondTab}`)!);
  view.rerender(<OperatorWorkspace />);
  expect(new URLSearchParams(mockSearch).get('thread')).toBe(secondCase);
  expect(new URLSearchParams(mockSearch).get('investigation')).toBe(secondRun);
  expect(screen.getByRole('textbox')).toHaveValue('');
  expect(createThread).toHaveBeenCalledTimes(2);
  expect(startInvestigation.mock.calls.map(([body]) => body.thread_id)).toEqual(
    [caseID, secondCase]
  );
});

it('hides a running tab without cancelling it and reopens its late accepted chat', async () => {
  const { view, startInvestigation } = setupWorkspace();
  let accept!: (value: unknown) => void;
  startInvestigation.mockReset().mockImplementation(
    () =>
      new Promise((resolve) => {
        accept = resolve;
      })
  );
  const firstTab = useWorkspaceSession.getState().operatorTabs[0].id;
  fireEvent.change(screen.getByRole('textbox'), {
    target: { value: 'Keep running after close' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Send question' }));
  await waitFor(() => expect(startInvestigation).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole('button', { name: 'New chat' }));
  view.rerender(<OperatorWorkspace />);
  fireEvent.change(screen.getByRole('textbox'), {
    target: { value: 'Keep this other draft' },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Close tab: Keep running after close' })
  );
  view.rerender(<OperatorWorkspace />);
  const currentURL = mockSearch;
  await act(async () =>
    accept({ investigation_id: investigationID, state: 'backgrounded' })
  );
  expect(mockSearch).toBe(currentURL);
  expect(useWorkspaceSession.getState().operatorTabs).toHaveLength(1);
  expect(screen.getByRole('textbox')).toHaveValue('Keep this other draft');
  expect(useWorkspaceSession.getState().closedOperatorTabs[0]).toEqual(
    expect.objectContaining({
      id: firstTab,
      threadID: caseID,
      href: expect.stringContaining(investigationID),
    })
  );
  fireEvent.keyDown(screen.getByRole('button', { name: 'Chat options' }), {
    key: 'ArrowDown',
  });
  fireEvent.click(
    await screen.findByRole('menuitem', { name: 'Reopen closed tab' })
  );
  view.rerender(<OperatorWorkspace />);
  expect(useWorkspaceSession.getState().operatorTabs).toHaveLength(2);
  expect(new URLSearchParams(mockSearch).get('thread')).toBe(caseID);
  expect(screen.getByRole('textbox')).toHaveValue('');
  expect(startInvestigation).toHaveBeenCalledTimes(1);
});

it('keeps a background budget failure out of another chat and requires a fresh explicit confirmation', async () => {
  const { view, createThread, startInvestigation } = setupWorkspace();
  let reject!: (error: unknown) => void;
  startInvestigation
    .mockReset()
    .mockImplementationOnce(
      () =>
        new Promise((_, fail) => {
          reject = fail;
        })
    )
    .mockRejectedValueOnce({
      code: 'ai_budget_confirmation_required',
      message: 'Please review this spend.',
    })
    .mockResolvedValueOnce({
      investigation_id: investigationID,
      state: 'backgrounded',
    });
  const firstTab = useWorkspaceSession.getState().operatorTabs[0].id;
  fireEvent.change(screen.getByRole('textbox'), {
    target: { value: 'Review this spend separately' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Send question' }));
  await waitFor(() => expect(startInvestigation).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole('button', { name: 'New chat' }));
  view.rerender(<OperatorWorkspace />);
  fireEvent.change(screen.getByRole('textbox'), {
    target: { value: 'Unrelated draft' },
  });
  await act(async () =>
    reject({
      code: 'ai_budget_confirmation_required',
      message: 'Please review this spend.',
    })
  );
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByRole('textbox')).toHaveValue('Unrelated draft');
  expect(document.getElementById(`operator-tab-${firstTab}`)).toHaveTextContent(
    'Needs review'
  );
  fireEvent.click(document.getElementById(`operator-tab-${firstTab}`)!);
  view.rerender(<OperatorWorkspace />);
  expect(screen.getByRole('textbox')).toHaveValue(
    'Review this spend separately'
  );
  fireEvent.click(screen.getByRole('button', { name: 'Send question' }));
  await screen.findByRole('dialog', { name: 'Continue above the AI budget?' });
  expect(startInvestigation.mock.calls[1][0].spend_acknowledged).toBe(false);
  fireEvent.click(
    screen.getByRole('button', { name: 'Continue with a paid answer' })
  );
  await waitFor(() => expect(startInvestigation).toHaveBeenCalledTimes(3));
  expect(startInvestigation.mock.calls[2][0]).toEqual(
    expect.objectContaining({
      thread_id: caseID,
      message: 'Review this spend separately',
      spend_acknowledged: true,
    })
  );
  expect(createThread).toHaveBeenCalledTimes(1);
});

it('prepares a follow-up from the selected earlier answer without submitting it or replacing current context', () => {
  mockSearch += `&thread=${caseID}&investigation=${investigationID}&evidence_for=${caseID}&sidebar=actions`;
  const { startInvestigation } = setupWorkspace(() => {
    localStorage.setItem('operator.sidebar.open', 'true');
    jest.mocked(hooks.useOperatorThread).mockReturnValue({
      data: {
        thread: { title: 'Storage chat', locale: 'en' },
        messages: [
          {
            id: caseID,
            kind: 'message',
            actor_type: 'admin',
            created_at: '2026-10-30T12:00:00Z',
            investigation_id: caseID,
            content: { text: 'Earlier storage question' },
          },
          {
            id: investigationID,
            kind: 'response',
            actor_type: 'operator',
            created_at: '2026-10-30T12:01:00Z',
            investigation_id: caseID,
            content: {
              blocks: [
                {
                  kind: 'conclusion',
                  text: 'Earlier answer',
                  evidence_ids: ['proof'],
                },
              ],
            },
          },
        ],
      },
    } as never);
  });
  fireEvent.click(
    screen.getByRole('button', {
      name: 'Check this question again with current evidence',
    })
  );
  expect(screen.getByRole('textbox')).toHaveValue(
    'Check this question again with current evidence: Earlier storage question'
  );
  expect(startInvestigation).not.toHaveBeenCalled();
  expect(
    screen.getByRole('combobox', { name: 'Working in' })
  ).toHaveTextContent('Media Circulation');
});

it('opens an activity question in its exact chat without a second navigation overwriting the target', () => {
  mockSearch += `&thread=${caseID}&investigation=${investigationID}&sidebar=tasks&panel=tasks`;
  const { view, startInvestigation } = setupWorkspace(() => {
    localStorage.setItem('operator.sidebar.open', 'true');
    jest.mocked(hooks.useOperatorTasks).mockReturnValue({
      data: {
        items: [
          {
            id: caseID,
            kind: 'investigation',
            title: 'Earlier question to inspect',
            state: 'completed',
            updated_at: '2026-10-30T12:00:00Z',
            thread_id: caseID,
            investigation_id: caseID,
            can_cancel: false,
            deep_link: `/platform/operator?thread=${caseID}&investigation=${caseID}`,
          },
        ],
      },
    } as never);
    jest.mocked(hooks.useOperatorThread).mockReturnValue({
      data: {
        thread: { title: 'Chat', locale: 'en' },
        messages: [
          {
            id: caseID,
            kind: 'message',
            actor_type: 'admin',
            created_at: '2026-10-30T12:00:00Z',
            investigation_id: caseID,
            content: { text: 'Earlier question' },
          },
          {
            id: investigationID,
            kind: 'message',
            actor_type: 'admin',
            created_at: '2026-10-30T12:01:00Z',
            investigation_id: investigationID,
            content: { text: 'Latest question' },
          },
        ],
      },
    } as never);
  });
  fireEvent.change(screen.getByRole('textbox'), {
    target: { value: 'Keep this draft' },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Earlier question to inspect' })
  );
  view.rerender(<OperatorWorkspace />);
  const params = new URLSearchParams(mockSearch);
  expect(params.get('focus')).toBe(caseID);
  expect(params.get('thread')).toBe(caseID);
  expect(params.get('investigation')).toBe(caseID);
  expect(params.get('evidence_for')).toBe(caseID);
  expect(hooks.useOperatorInvestigationEvents).toHaveBeenLastCalledWith(
    investigationID
  );
  expect(screen.getByRole('textbox')).toHaveValue('Keep this draft');
  expect(startInvestigation).not.toHaveBeenCalled();
});

it('opens a focused inspector from its citation and returns directly to chat history', () => {
  mockSearch += `&thread=${caseID}&investigation=${investigationID}`;
  const { view } = setupWorkspace(() => {
    jest.mocked(hooks.useOperatorThread).mockReturnValue({
      data: {
        thread: { title: 'My investigation', locale: 'en' },
        messages: [
          {
            id: caseID,
            kind: 'message',
            actor_type: 'admin',
            created_at: '2026-10-30T12:00:00Z',
            investigation_id: caseID,
            content: { text: 'Earlier question' },
          },
          {
            id: investigationID,
            kind: 'response',
            actor_type: 'operator',
            created_at: '2026-10-30T12:01:00Z',
            investigation_id: caseID,
            content: {
              blocks: [
                {
                  kind: 'conclusion',
                  text: 'Earlier answer to inspect',
                  evidence_ids: ['earlier-proof'],
                },
              ],
            },
          },
        ],
      },
    } as never);
  });
  fireEvent.change(screen.getByRole('textbox'), {
    target: { value: 'Keep my question' },
  });
  fireEvent.click(
    within(screen.getByRole('log')).getAllByRole('button', {
      name: 'Sources (1)',
    })[0]
  );
  view.rerender(<OperatorWorkspace />);
  expect(screen.getByRole('heading', { name: 'Sources' })).toBeVisible();
  expect(
    screen.queryByRole('navigation', { name: 'Sidebar views' })
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Back to chats' }));
  view.rerender(<OperatorWorkspace />);
  expect(screen.getByRole('textbox', { name: 'Search chats' })).toBeVisible();
  fireEvent.click(
    within(screen.getByRole('log')).getAllByRole('button', {
      name: 'Sources (1)',
    })[0]
  );
  view.rerender(<OperatorWorkspace />);
  view.unmount();
  render(<OperatorWorkspace />);
  expect(screen.getByRole('heading', { name: 'Sources' })).toBeVisible();
  expect(screen.getByRole('region', { name: 'Sources' })).toHaveTextContent(
    'Earlier question'
  );
  expect(new URLSearchParams(mockSearch).get('evidence_for')).toBe(caseID);
  expect(JSON.parse(new URLSearchParams(mockSearch).get('citations')!)).toEqual(
    ['earlier-proof']
  );
  expect(
    screen.getByRole('textbox', { name: /Ask what is happening/ })
  ).toHaveValue('Keep my question');
  expect(
    screen.queryByRole('button', { name: 'Details' })
  ).not.toBeInTheDocument();
});

it('keeps the Chats list open when selecting a conversation that previously showed sources', () => {
  mockSearch += `&thread=${caseID}&sidebar=history`;
  const { view } = setupWorkspace(() => {
    localStorage.setItem('operator.sidebar.open', 'true');
    useWorkspaceSession.getState().openOperatorTab({
      id: investigationID,
      threadID: investigationID,
      title: 'Another chat',
      href: `/platform/operator?domain=storage_quality&view=storage&thread=${investigationID}&sidebar=evidence&evidence_for=${caseID}`,
    });
    jest.mocked(hooks.useOperatorThreads).mockReturnValue({
      data: {
        items: [
          {
            id: investigationID,
            title: 'Another chat',
            locale: 'en',
            last_activity_at: '2026-10-30T12:00:00Z',
            last_domain: 'storage_quality',
          },
        ],
      },
    } as never);
  });
  fireEvent.click(
    within(screen.getByRole('region', { name: 'Chats' })).getByRole('button', {
      name: /^Another chat/,
    })
  );
  view.rerender(<OperatorWorkspace />);
  expect(screen.getByRole('heading', { name: 'Chats' })).toBeVisible();
  expect(screen.getByRole('textbox', { name: 'Search chats' })).toBeVisible();
  expect(
    screen.queryByRole('button', { name: 'Details' })
  ).not.toBeInTheDocument();
  expect(new URLSearchParams(mockSearch).get('evidence_for')).toBe(caseID);
});
