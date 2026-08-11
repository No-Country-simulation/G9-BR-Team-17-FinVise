import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ChoiceSelect } from '@/components/ui/ChoiceSelect';

const options = [
  { value: 'csv', label: 'Conta principal', description: 'Arquivo CSV importado' },
  { value: 'open-finance', label: 'Banco conectado', description: 'Conta conectada' },
];

describe('ChoiceSelect', () => {
  it('abre o menu e seleciona uma opção com o mouse', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <ChoiceSelect
        label="Fonte dos dados"
        value="csv"
        options={options}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole('combobox', { name: 'Fonte dos dados' }));
    expect(screen.getByRole('listbox', { name: 'Fonte dos dados' })).toBeInTheDocument();

    await user.click(screen.getByRole('option', { name: /Banco conectado/i }));
    expect(onChange).toHaveBeenCalledWith('open-finance');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('permite navegar e selecionar usando apenas o teclado', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <ChoiceSelect
        label="Fonte dos dados"
        value="csv"
        options={options}
        onChange={onChange}
      />,
    );

    const trigger = screen.getByRole('combobox', { name: 'Fonte dos dados' });
    trigger.focus();
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');

    expect(onChange).toHaveBeenCalledWith('open-finance');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });
});
