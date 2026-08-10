import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';

describe('acessibilidade dos campos de formulário', () => {
  it('associa automaticamente a mensagem de erro ao input', () => {
    render(
      <div>
        <label htmlFor="amount">Valor</label>
        <Input id="amount" error="Informe um valor válido" />
      </div>
    );

    const input = screen.getByRole('textbox', { name: 'Valor' });
    const error = screen.getByText('Informe um valor válido');

    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', error.id);
  });

  it('associa automaticamente a mensagem de erro ao select', () => {
    render(
      <div>
        <label htmlFor="category">Categoria</label>
        <Select
          id="category"
          error="Selecione uma categoria"
          options={[{ value: '', label: 'Selecione' }]}
        />
      </div>
    );

    const select = screen.getByRole('combobox', { name: 'Categoria' });
    const error = screen.getByText('Selecione uma categoria');

    expect(select).toHaveAttribute('aria-invalid', 'true');
    expect(select).toHaveAttribute('aria-describedby', error.id);
  });
});
