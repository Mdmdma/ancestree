import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DateInput from '../../components/DateInput';

// Mock the Button component used by DateInput
vi.mock('../../components/Button', () => ({
  default: ({ children, onClick, ...props }) => (
    <button onClick={onClick} {...props}>{children}</button>
  ),
}));

describe('DateInput', () => {
  it('renders with a label', () => {
    render(<DateInput label="Geburtsdatum" value="" onChange={() => {}} />);
    expect(screen.getByText('Geburtsdatum')).toBeInTheDocument();
  });

  it('displays value in German format when given ISO date', () => {
    render(<DateInput label="Datum" value="1990-05-15" onChange={() => {}} />);
    expect(screen.getByDisplayValue('15.05.1990')).toBeInTheDocument();
  });

  it('calls onChange when a complete date is entered', () => {
    const handleChange = vi.fn();
    render(<DateInput label="Datum" value="" onChange={handleChange} />);

    const input = screen.getByPlaceholderText('dd.mm.yyyy');

    // Simulate typing a complete date by directly firing a change event with the
    // full formatted value. The component's handleTextChange converts 10-char
    // German dates to ISO and calls onChange.
    fireEvent.change(input, { target: { value: '15.05.1990' } });

    expect(handleChange).toHaveBeenCalled();
    const lastCall = handleChange.mock.calls[handleChange.mock.calls.length - 1];
    expect(lastCall[0].target.value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('accepts skip marker "000" in the value', () => {
    render(<DateInput label="Datum" value="000" onChange={() => {}} />);
    expect(screen.getByDisplayValue('000')).toBeInTheDocument();
  });

  it('propagates skip marker via onChange when typed', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(<DateInput label="Datum" value="" onChange={handleChange} />);

    const input = screen.getByPlaceholderText('dd.mm.yyyy');
    await user.type(input, '000');

    // The component fires onChange with SKIP_MARKER when "000" is fully typed
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        target: expect.objectContaining({ value: '000' }),
      })
    );
  });

  it('handles clear functionality via showClearButton + onClear', async () => {
    const user = userEvent.setup();
    const handleClear = vi.fn();
    render(
      <DateInput
        label="Datum"
        value="1990-05-15"
        onChange={() => {}}
        showClearButton
        onClear={handleClear}
      />
    );

    // Clear button should appear because value is non-empty and showClearButton is true
    const clearButton = screen.getByTitle('Clear date');
    await user.click(clearButton);
    expect(handleClear).toHaveBeenCalled();
  });

  it('handles clear via onChange when onClear is not provided', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(
      <DateInput
        label="Datum"
        value="1990-05-15"
        onChange={handleChange}
        showClearButton
      />
    );

    const clearButton = screen.getByTitle('Clear date');
    await user.click(clearButton);
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        target: expect.objectContaining({ value: '' }),
      })
    );
  });

  it('shows error message when error prop is set', () => {
    render(
      <DateInput label="Datum" value="" onChange={() => {}} error="Required" />
    );
    expect(screen.getByText('Required')).toBeInTheDocument();
  });
});
