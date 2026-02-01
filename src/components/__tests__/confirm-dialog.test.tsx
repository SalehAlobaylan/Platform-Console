import { render, screen, fireEvent } from '@testing-library/react';
import { ConfirmDialog } from '../../shared/confirm-dialog';

describe('ConfirmDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: jest.fn(),
    title: 'Confirm Action',
    description: 'Are you sure you want to proceed?',
    onConfirm: jest.fn(),
  };

  it('should render when open is true', () => {
    render(<ConfirmDialog {...defaultProps} />);

    expect(screen.getByText('Confirm Action')).toBeInTheDocument();
    expect(
      screen.getByText('Are you sure you want to proceed?')
    ).toBeInTheDocument();
  });

  it('should render with custom button labels', () => {
    render(
      <ConfirmDialog
        {...defaultProps}
        confirmLabel="Yes, Delete"
        cancelLabel="No, Keep"
      />
    );

    expect(
      screen.getByRole('button', { name: /yes, delete/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /no, keep/i })
    ).toBeInTheDocument();
  });

  it('should call onConfirm when confirm button is clicked', () => {
    render(<ConfirmDialog {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));

    expect(defaultProps.onConfirm).toHaveBeenCalled();
  });

  it('should call onCancel and onOpenChange when cancel is clicked', () => {
    const onCancel = jest.fn();
    render(<ConfirmDialog {...defaultProps} onCancel={onCancel} />);

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(onCancel).toHaveBeenCalled();
    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
  });

  it('should show loading state', () => {
    render(<ConfirmDialog {...defaultProps} isLoading />);

    const confirmButton = screen.getByRole('button', { name: /processing/i });
    expect(confirmButton).toBeDisabled();
  });

  it('should apply destructive variant styling', () => {
    render(<ConfirmDialog {...defaultProps} variant="destructive" />);

    // The destructive button should be present
    const deleteButton = screen.getByRole('button', { name: /confirm/i });
    expect(deleteButton).toBeInTheDocument();
  });

  it('should disable buttons when isLoading is true', () => {
    render(<ConfirmDialog {...defaultProps} isLoading />);

    expect(screen.getByRole('button', { name: /processing/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();
  });
});
