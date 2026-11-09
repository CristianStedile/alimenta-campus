import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const api = vi.hoisted(() => ({
  apiRequest: vi.fn(),
  clearAccessToken: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  refreshAccessToken: vi.fn(),
}));

vi.mock('../src/api.js', () => api);

import App from '../src/App.jsx';

describe('aplicação autenticada', () => {
  beforeEach(() => {
    api.apiRequest.mockReset();
    api.clearAccessToken.mockReset();
    api.login.mockReset();
    api.logout.mockReset();
    api.refreshAccessToken.mockReset();
    api.refreshAccessToken.mockResolvedValue(null);
    api.apiRequest.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('restaura a sessão e carrega pedidos ao iniciar com refresh válido', async () => {
    api.refreshAccessToken.mockResolvedValue('access-restaurado');

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Meus pedidos' })).toBeInTheDocument();
    expect(api.apiRequest).toHaveBeenCalledWith('/pedidos');
  });

  it('mostra a tela de login quando não há refresh válido', async () => {
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Bem-vindo(a)!' })).toBeInTheDocument();
  });

  it('faz login, chama a rota protegida e mostra pedidos', async () => {
    const user = userEvent.setup();
    api.login.mockResolvedValue('access-novo');
    api.apiRequest.mockResolvedValue([{ id: 'AC-101', resumo: 'Pedido de teste' }]);

    render(<App />);
    await screen.findByRole('heading', { name: 'Bem-vindo(a)!' });
    await user.type(screen.getByLabelText('E-mail'), 'aluna@udesc.br');
    await user.type(screen.getByLabelText('Senha'), 'senha-segura');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(api.login).toHaveBeenCalledWith('aluna@udesc.br', 'senha-segura');
    expect(await screen.findByText('Pedido de teste')).toBeInTheDocument();
    expect(api.apiRequest).toHaveBeenCalledWith('/pedidos');
  });

  it('exibe erro genérico quando o login retorna 401', async () => {
    const user = userEvent.setup();
    api.login.mockRejectedValue(Object.assign(new Error('credenciais inválidas'), { status: 401 }));

    render(<App />);
    await screen.findByRole('heading', { name: 'Bem-vindo(a)!' });
    await user.type(screen.getByLabelText('E-mail'), 'aluna@udesc.br');
    await user.type(screen.getByLabelText('Senha'), 'senha-errada');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha inválidos.');
  });

  it('encerra sessão e volta ao login', async () => {
    const user = userEvent.setup();
    api.refreshAccessToken.mockResolvedValue('access-restaurado');

    render(<App />);
    await screen.findByRole('heading', { name: 'Meus pedidos' });
    await user.click(screen.getByRole('button', { name: 'Sair' }));

    expect(api.logout).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Bem-vindo(a)!' })).toBeInTheDocument());
  });
});
