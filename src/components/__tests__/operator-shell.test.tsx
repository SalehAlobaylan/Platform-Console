import { render, screen } from '@testing-library/react';
import { DashboardShell } from '@/components/layout/DashboardShell';

let mockPath = '/platform/operator';
jest.mock('next/navigation', () => ({ usePathname: () => mockPath }));
jest.mock('@/components/layout/Sidebar', () => ({
  Sidebar: () => <nav>Console navigation</nav>,
}));
jest.mock('@/components/layout/Header', () => ({
  Header: () => <header>Console header</header>,
}));
jest.mock('@/components/layout/workspace-navigation', () => ({
  WorkspaceNavigation: () => null,
}));
jest.mock('@/components/operator/operator-context-provider', () => ({
  OperatorContextProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

it('gives Operator the full viewport while keeping dashboard chrome on other routes', () => {
  const view = render(
    <DashboardShell>
      <div>Conversation workspace</div>
    </DashboardShell>
  );
  expect(screen.getByText('Conversation workspace')).toBeVisible();
  expect(screen.getByRole('main')).toHaveClass('h-dvh', 'overflow-hidden');
  expect(screen.queryByText('Console navigation')).not.toBeInTheDocument();
  expect(screen.queryByText('Console header')).not.toBeInTheDocument();
  expect(screen.queryByText('Operator dock')).not.toBeInTheDocument();
  mockPath = '/platform/storage';
  view.rerender(
    <DashboardShell>
      <div>Storage workflow</div>
    </DashboardShell>
  );
  expect(screen.getByText('Console navigation')).toBeVisible();
  expect(screen.getByText('Console header')).toBeVisible();
  expect(screen.queryByText('Operator dock')).not.toBeInTheDocument();
});
