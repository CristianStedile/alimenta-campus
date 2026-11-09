import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  apiRequest,
  clearAccessToken,
  getAccessToken,
  login,
  refreshAccessToken,
  setAccessToken,
} from '../src/api.js';

function jsonResponse(status, body) {
  return {
    status,
    ok: status >= 200 && status < 300,
    async json() { return body; },
  };
}

describe('cliente da API', () => {
  beforeEach(() => {
    clearAccessToken();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('envia credenciais ao login e mantém access token somente em memória', async () => {
    fetch.mockResolvedValue(jsonResponse(200, { accessToken: 'access-1' }));
    const storageWrite = vi.spyOn(Storage.prototype, 'setItem');

    await login('aluna@udesc.br', 'senha-segura');

    expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/\/login$/), expect.objectContaining({
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({ email: 'aluna@udesc.br', senha: 'senha-segura' }),
    }));
    expect(getAccessToken()).toBe('access-1');
    expect(storageWrite).not.toHaveBeenCalled();
  });

  it('envia Bearer e renova uma vez após 401 antes de repetir a chamada', async () => {
    setAccessToken('access-expirado');
    fetch
      .mockResolvedValueOnce(jsonResponse(401, { erro: 'token inválido ou expirado' }))
      .mockResolvedValueOnce(jsonResponse(200, { accessToken: 'access-renovado' }))
      .mockResolvedValueOnce(jsonResponse(200, [{ id: 'AC-101' }]));

    const pedidos = await apiRequest('/pedidos');

    expect(pedidos).toEqual([{ id: 'AC-101' }]);
    expect(fetch).toHaveBeenNthCalledWith(1, expect.stringMatching(/\/pedidos$/), expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer access-expirado' }),
    }));
    expect(fetch).toHaveBeenNthCalledWith(2, expect.stringMatching(/\/auth\/refresh$/), expect.objectContaining({
      method: 'POST', credentials: 'include',
    }));
    expect(fetch).toHaveBeenNthCalledWith(3, expect.stringMatching(/\/pedidos$/), expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer access-renovado' }),
    }));
    expect(getAccessToken()).toBe('access-renovado');
  });

  it('limpa token em memória quando refresh falha', async () => {
    setAccessToken('access-expirado');
    fetch
      .mockResolvedValueOnce(jsonResponse(401, { erro: 'token expirado' }))
      .mockResolvedValueOnce(jsonResponse(401, { erro: 'faça login novamente' }));

    await expect(apiRequest('/pedidos')).rejects.toMatchObject({ status: 401 });
    expect(getAccessToken()).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('compartilha uma renovação em andamento entre chamadas simultâneas', async () => {
    fetch.mockResolvedValue(jsonResponse(200, { accessToken: 'access-renovado' }));

    const firstRefresh = refreshAccessToken();
    const secondRefresh = refreshAccessToken();

    await expect(Promise.all([firstRefresh, secondRefresh])).resolves.toEqual([
      'access-renovado',
      'access-renovado',
    ]);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
