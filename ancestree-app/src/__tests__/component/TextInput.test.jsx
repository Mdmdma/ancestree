import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TextInput from '../../components/TextInput';

describe('TextInput', () => {
  it('renders with label text', () => {
    render(<TextInput label="Vorname" value="" onChange={() => {}} />);
    expect(screen.getByText('Vorname')).toBeInTheDocument();
  });

  it('displays value prop', () => {
    render(<TextInput label="Name" value="Max" onChange={() => {}} />);
    expect(screen.getByDisplayValue('Max')).toBeInTheDocument();
  });

  it('calls onChange when typed into', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(<TextInput label="Name" value="" onChange={handleChange} />);

    const input = screen.getByRole('textbox');
    await user.type(input, 'A');
    expect(handleChange).toHaveBeenCalled();
  });

  it('shows error message when error prop is set', () => {
    render(
      <TextInput label="Email" value="" onChange={() => {}} error="Ungueltig" />
    );
    expect(screen.getByText('Ungueltig')).toBeInTheDocument();
  });

  it('respects readOnly prop', () => {
    render(<TextInput label="Name" value="Max" onChange={() => {}} readOnly />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('readOnly');
  });

  it('renders placeholder text', () => {
    render(
      <TextInput
        label="Name"
        value=""
        onChange={() => {}}
        placeholder="Bitte eingeben"
      />
    );
    expect(screen.getByPlaceholderText('Bitte eingeben')).toBeInTheDocument();
  });

  it('renders helper text when no error', () => {
    render(
      <TextInput
        label="Name"
        value=""
        onChange={() => {}}
        helperText="Optional field"
      />
    );
    expect(screen.getByText('Optional field')).toBeInTheDocument();
  });

  it('hides helper text when error is shown', () => {
    render(
      <TextInput
        label="Name"
        value=""
        onChange={() => {}}
        error="Required"
        helperText="Optional field"
      />
    );
    expect(screen.getByText('Required')).toBeInTheDocument();
    expect(screen.queryByText('Optional field')).not.toBeInTheDocument();
  });
});
