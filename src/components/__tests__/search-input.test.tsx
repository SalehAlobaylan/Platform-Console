import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { SearchInput } from '../../shared/search-input';

// Mock the useDebounce hook to avoid timing issues in tests
jest.mock('../../hooks/use-debounce', () => ({
  useDebounce: (value: string) => value,
}));

describe('SearchInput', () => {
  it('should render with placeholder', () => {
    render(
      <SearchInput value="" onChange={() => {}} placeholder="Search items..." />
    );

    expect(screen.getByPlaceholderText('Search items...')).toBeInTheDocument();
  });

  it('should display current value', () => {
    render(<SearchInput value="test query" onChange={() => {}} />);

    expect(screen.getByDisplayValue('test query')).toBeInTheDocument();
  });

  it('should call onChange when typing', async () => {
    const handleChange = jest.fn();
    render(<SearchInput value="" onChange={handleChange} />);

    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'hello');

    await waitFor(() => {
      expect(handleChange).toHaveBeenCalledWith('h');
      expect(handleChange).toHaveBeenCalledWith('he');
      expect(handleChange).toHaveBeenCalledWith('hel');
      expect(handleChange).toHaveBeenCalledWith('hell');
      expect(handleChange).toHaveBeenCalledWith('hello');
    });
  });

  it('should show clear button when value is not empty', () => {
    render(<SearchInput value="test" onChange={() => {}} />);

    expect(
      screen.getByRole('button', { name: /clear search/i })
    ).toBeInTheDocument();
  });

  it('should not show clear button when value is empty', () => {
    render(<SearchInput value="" onChange={() => {}} />);

    expect(
      screen.queryByRole('button', { name: /clear search/i })
    ).not.toBeInTheDocument();
  });

  it('should clear value when clear button is clicked', async () => {
    const handleChange = jest.fn();
    render(<SearchInput value="test" onChange={handleChange} />);

    const clearButton = screen.getByRole('button', { name: /clear search/i });
    await userEvent.click(clearButton);

    expect(handleChange).toHaveBeenCalledWith('');
  });

  it('should hide clear button when showClearButton is false', () => {
    render(
      <SearchInput value="test" onChange={() => {}} showClearButton={false} />
    );

    expect(
      screen.queryByRole('button', { name: /clear search/i })
    ).not.toBeInTheDocument();
  });

  it('should sync with external value changes', () => {
    function TestComponent() {
      const [value, setValue] = useState('initial');
      return (
        <>
          <SearchInput value={value} onChange={setValue} />
          <button onClick={() => setValue('updated')}>Update</button>
        </>
      );
    }

    render(<TestComponent />);

    expect(screen.getByDisplayValue('initial')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /update/i }));

    expect(screen.getByDisplayValue('updated')).toBeInTheDocument();
  });
});
