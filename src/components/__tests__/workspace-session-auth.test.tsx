import { act, render } from '@testing-library/react';
import { AuthProvider } from '@/components/auth/auth-provider';
import { clearAuthState, useAuthStore } from '@/lib/stores/auth';
import { useWorkspaceSession } from '@/lib/stores/workspace-session';

jest.mock('@/lib/runtime-fetch', () => ({}));

it('scopes continuity to the current user and tenant and clears it on sign-out', () => {
  sessionStorage.clear();
  useWorkspaceSession.setState({
    owner: undefined,
    operatorTabs: [],
    closedOperatorTabs: [],
    operatorRequests: {},
    drafts: {},
    consoleHref: '/',
    operatorHref: '/platform/operator',
  });
  useAuthStore.setState({
    user: {
      id: 'user-a',
      tenant_id: 'tenant-a',
      email: 'a@example.test',
      role: 'admin',
    },
    isAuthenticated: true,
    isLoading: false,
    checkAuth: jest.fn().mockResolvedValue(undefined),
  });
  const view = render(
    <AuthProvider>
      <span>Authenticated app</span>
    </AuthProvider>
  );
  expect(useWorkspaceSession.getState().owner).toContain('tenant-a:user-a');
  act(() =>
    useWorkspaceSession.getState().visit('/platform/storage?section=policy')
  );
  act(() =>
    useAuthStore.setState({
      user: {
        id: 'user-b',
        tenant_id: 'tenant-b',
        email: 'b@example.test',
        role: 'admin',
      },
    })
  );
  expect(useWorkspaceSession.getState().owner).toContain('tenant-b:user-b');
  expect(useWorkspaceSession.getState().consoleHref).toBe('/');
  act(() => useWorkspaceSession.getState().visit('/platform/pipeline'));
  expect(sessionStorage.getItem('wahb-workspace-session/v1')).not.toBeNull();
  act(() => clearAuthState());
  expect(useWorkspaceSession.getState()).toEqual(
    expect.objectContaining({
      owner: undefined,
      operatorTabs: [],
      closedOperatorTabs: [],
      operatorRequests: {},
      consoleHref: '/',
      operatorHref: '/platform/operator',
      drafts: {},
    })
  );
  expect(sessionStorage.getItem('wahb-workspace-session/v1')).toBeNull();
  view.unmount();
});
