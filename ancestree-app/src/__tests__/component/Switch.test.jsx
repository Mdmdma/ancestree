import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Switch from '../../components/Switch';

describe('Switch', () => {
  it('renders in unchecked state', () => {
    render(<Switch checked={false} onChange={() => {}} />);
    const toggle = screen.getByRole('switch');
    expect(toggle).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-checked', 'false');
  });

  it('renders in checked state', () => {
    render(<Switch checked={true} onChange={() => {}} />);
    const toggle = screen.getByRole('switch');
    expect(toggle).toHaveAttribute('aria-checked', 'true');
  });

  it('calls onChange when clicked', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(<Switch checked={false} onChange={handleChange} />);

    const toggle = screen.getByRole('switch');
    await user.click(toggle);
    expect(handleChange).toHaveBeenCalledWith(true);
  });

  it('does not call onChange when disabled', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(<Switch checked={false} onChange={handleChange} disabled />);

    const toggle = screen.getByRole('switch');
    await user.click(toggle);
    expect(handleChange).not.toHaveBeenCalled();
  });

  it('has correct aria-checked attribute', () => {
    const { rerender } = render(
      <Switch checked={false} onChange={() => {}} />
    );
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');

    rerender(<Switch checked={true} onChange={() => {}} />);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  });

  it('renders label when provided', () => {
    render(<Switch checked={false} onChange={() => {}} label="Dark Mode" />);
    expect(screen.getByText('Dark Mode')).toBeInTheDocument();
  });

  it('renders helper text below label', () => {
    render(
      <Switch
        checked={false}
        onChange={() => {}}
        label="Notifications"
        helperText="Enable push notifications"
      />
    );
    expect(screen.getByText('Enable push notifications')).toBeInTheDocument();
  });
});
