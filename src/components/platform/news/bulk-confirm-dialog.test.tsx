import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BulkConfirmDialog } from './bulk-confirm-dialog';

it('sends one reviewed request and keeps a failed commit visible', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    let rejectCommit!: (error: Error) => void;
    const commit = jest.fn(() => new Promise<never>((_, reject) => {
        rejectCommit = reject;
    }));

    render(<BulkConfirmDialog
        onClose={onClose}
        config={{
            title: 'Delete selected items',
            actionLabel: 'Delete',
            destructive: true,
            preview: async () => 2,
            commit,
        }}
    />);

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(commit).not.toHaveBeenCalled();
    onClose.mockClear();

    const confirm = await screen.findByRole('button', { name: 'Delete 2' });
    await user.click(confirm);
    await user.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
    expect(confirm).toBeDisabled();
    expect(commit).toHaveBeenCalledTimes(1);

    await act(async () => rejectCommit(new Error('Review expired')));
    expect(screen.getByRole('alert')).toHaveTextContent('Review expired');
    expect(confirm).toBeEnabled();
    expect(onClose).not.toHaveBeenCalled();
});
