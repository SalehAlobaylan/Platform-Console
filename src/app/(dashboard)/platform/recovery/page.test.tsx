import { render, screen } from '@testing-library/react';
import RecoveryPage from './page';

jest.mock('./_components/feed-recovery-panel', () => ({
  __esModule: true,
  default: () => <div>Bounded Pods reset and feed repair</div>,
}));

it.each(['/platform/recovery', '/platform/recovery?campaign=old-campaign', '/platform/recovery?view=feed-recovery'])(
  'uses native maintenance at %s', (url) => {
    window.history.replaceState(null, '', url);
    render(<RecoveryPage />);
    expect(screen.getByText('Bounded Pods reset and feed repair')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Create preview|Continue inventory|Review approval/ })).not.toBeInTheDocument();
  }
);
