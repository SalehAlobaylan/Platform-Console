import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { StrictMode } from 'react';
import { WorkspaceHeader } from '@/components/layout/workspace-header';
import { WorkspaceNavigation } from '@/components/layout/workspace-navigation';
import { OperatorLaunchLink } from '@/components/operator/operator-launch-link';
import { useWorkspaceSession } from '@/lib/stores/workspace-session';
import { consumeOperatorLaunchContext } from '@/lib/operator/launch-context';

let mockPath = '/platform/storage',
  mockSearch = 'tab=quality';
const push = jest.fn();
jest.mock('@/lib/console-auth-capabilities', () => ({ useConsoleAuthCapabilities: () => undefined }));

jest.mock('@/lib/navigation', () => ({
  usePathname: () => mockPath,
  useSearchParams: () => new URLSearchParams(mockSearch),
  useRouter: () => ({ push }),
}));
jest.mock('@/components/operator/operator-activity-badge', () => ({
  OperatorActivityBadge: () => null,
}));
const context = {
  schema_version: 'wahb-operator/v1' as const,
  domain: 'storage_quality',
  view: 'storage',
  filters: { tab: 'quality' },
  subjects: [],
  available_intents: ['explain' as const],
};
const resume =
  '/platform/operator?thread=chat&investigation=run&domain=media_circulation&view=cockpit';

beforeEach(() => {
  jest.clearAllMocks();
  sessionStorage.clear();
  localStorage.setItem('theme', 'light');
  document.documentElement.classList.remove('dark');
  mockPath = '/platform/storage';
  mockSearch = 'tab=quality';
  window.history.replaceState({}, '', '/platform/storage?tab=quality');
  useWorkspaceSession.setState({
    owner: undefined,
    operatorTabs: [],
    closedOperatorTabs: [],
    operatorRequests: {},
    consoleHref: '/',
    operatorHref: resume,
    consoleScroll: {},
    drafts: {},
    locale: 'en',
    focusAfterSwitch: undefined,
  });
});

function Workspace() {
  return (
    <>
      <WorkspaceNavigation />
      <WorkspaceHeader workspace={mockPath === '/platform/operator' ? 'operator' : 'console'}>
        <span>Current page</span>
      </WorkspaceHeader>
      <main id="console-scroll-region">
        <div>Content</div>
      </main>
    </>
  );
}

it('keeps a visible switch in both workspaces and restores the exact last destinations', async () => {
  const view = render(<Workspace />);
  const navigation = screen.getByRole('navigation', { name: 'Workspace' });
  expect(
    within(navigation).getByRole('link', { name: 'Console' })
  ).toHaveAttribute('aria-current', 'page');
  expect(
    within(navigation).getByRole('link', { name: 'Operator' })
  ).toHaveAttribute('href', resume);
  mockPath = '/platform/operator';
  mockSearch = resume.split('?')[1];
  view.rerender(<Workspace />);
  expect(
    within(navigation).getByRole('link', { name: 'Console' })
  ).toHaveAttribute('href', '/platform/storage?tab=quality');
  expect(
    within(navigation).getByRole('link', { name: 'Operator' })
  ).toHaveAttribute('aria-current', 'page');
  expect(consumeOperatorLaunchContext()).toBeUndefined();
  await waitFor(() =>
    expect(useWorkspaceSession.getState().operatorHref).toBe(resume)
  );
});

it('keeps appearance and account controls in the same menu across workspaces', async () => {
  localStorage.setItem('theme', 'light');
  const view = render(<Workspace />);
  fireEvent.keyDown(screen.getByRole('button', { name: 'Account options' }), {
    key: 'ArrowDown',
  });
  expect(screen.getByRole('menuitem', { name: 'Sign out' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('menuitem', { name: 'Dark appearance' }));
  expect(document.documentElement).toHaveClass('dark');
  mockPath = '/platform/operator';
  view.rerender(<Workspace />);
  fireEvent.keyDown(screen.getByRole('button', { name: 'Account options' }), {
    key: 'ArrowDown',
  });
  await waitFor(() => expect(
    screen.getByRole('menuitem', { name: 'Light appearance' })
  ).toBeVisible());
  expect(screen.getByRole('menuitem', { name: 'Sign out' })).toBeInTheDocument();
  fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
  localStorage.removeItem('theme');
  document.documentElement.classList.remove('dark');
});

it('restores Console scrolling after a round trip and keeps the shortcut consistent', async () => {
  const view = render(<Workspace />),
    main = screen.getByRole('main');
  await act(async () => {
    await new Promise((resolve) => requestAnimationFrame(resolve));
  });
  main.scrollTop = 450;
  fireEvent.scroll(main);
  fireEvent.keyDown(window, { key: 'j', ctrlKey: true });
  expect(push).toHaveBeenLastCalledWith(resume, { scroll: false });
  mockPath = '/platform/operator';
  mockSearch = resume.split('?')[1];
  view.rerender(<Workspace />);
  expect(
    useWorkspaceSession.getState().consoleScroll[
      '/platform/storage?tab=quality'
    ]
  ).toBe(450);
  main.scrollTop = 0;
  fireEvent.keyDown(window, { key: 'j', ctrlKey: true });
  expect(push).toHaveBeenLastCalledWith('/platform/storage?tab=quality', {
    scroll: false,
  });
  mockPath = '/platform/storage';
  mockSearch = 'tab=quality';
  view.rerender(<Workspace />);
  await waitFor(() => expect(main.scrollTop).toBe(450));
});

it('delegates keyboard navigation to the router without changing scroll', () => {
  render(<Workspace />);
  fireEvent.keyDown(window, { key: 'j', metaKey: true });
  expect(push).toHaveBeenCalledWith(resume, { scroll: false });
});

it('does not override a native Console section change with a scroll reset', async () => {
  const view = render(<Workspace />),
    main = screen.getByRole('main');
  await act(async () => {
    await new Promise((resolve) => requestAnimationFrame(resolve));
  });
  main.scrollTop = 450;
  fireEvent.scroll(main);
  mockSearch = 'section=policy';
  view.rerender(<Workspace />);
  await act(async () => {
    await new Promise((resolve) => requestAnimationFrame(resolve));
  });
  expect(main.scrollTop).toBe(450);
});

it('restores a saved Console position during Strict Mode mount replay', async () => {
  useWorkspaceSession.setState({
    consoleScroll: { '/platform/storage?tab=quality': 450 },
  });
  render(
    <StrictMode>
      <Workspace />
    </StrictMode>
  );
  await waitFor(() => expect(screen.getByRole('main').scrollTop).toBe(450));
});

it('contextual entry resumes the chat, attaches explicit context and never sends', () => {
  render(
    <OperatorLaunchLink context={context}>
      Ask about this page
    </OperatorLaunchLink>
  );
  const link = screen.getByRole('link', { name: 'Ask about this page' });
  const href = new URL(link.getAttribute('href')!, 'http://localhost');
  expect(href.pathname).toBe('/platform/operator');
  expect(href.searchParams.get('thread')).toBe('chat');
  expect(href.searchParams.get('investigation')).toBe('run');
  expect(href.searchParams.get('domain')).toBe('storage_quality');
  fireEvent.click(link);
  expect(consumeOperatorLaunchContext('storage_quality', 'storage')).toEqual(
    context
  );
  expect(push).not.toHaveBeenCalled();
});

it('does not attach context when a contextual link is disabled', () => {
  render(<OperatorLaunchLink context={context} disabled />);
  const link = screen.getByRole('link');
  expect(link).toHaveAttribute('aria-disabled', 'true');
  expect(link).not.toHaveAttribute('href');
  fireEvent.click(link, { ctrlKey: true });
  expect(consumeOperatorLaunchContext()).toBeUndefined();
});
