import jwt from 'jsonwebtoken';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cookiePair, createTestContext, loginUser, registerUser, TEST_JWT_SECRET } from './helpers.js';

describe('login e sessão', () => {
  let context;

  beforeEach(async () => {
    context = await createTestContext();
    await registerUser(context);
  });

  afterEach(async () => {
    await context.close();
  });

  it('emite access token de 15 minutos e cookie refresh seguro', async () => {
    const response = await loginUser(context);
    expect(response.status).toBe(200);
    const { accessToken } = await response.json();
    const payload = jwt.verify(accessToken, TEST_JWT_SECRET, { algorithms: ['HS256'] });
    expect(payload.sub).toBeTruthy();
    expect(payload.exp - payload.iat).toBe(15 * 60);

    const cookie = response.headers.get('set-cookie');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=Strict');
    expect(cookie).toContain('Path=/auth');
    expect(cookie).not.toContain(accessToken);
  });

  it('usa a mesma resposta genérica 401 para conta inexistente e senha incorreta', async () => {
    const wrongPassword = await context.request('/login', {
      method: 'POST', body: { email: 'aluna@udesc.br', senha: 'senha errada' },
    });
    const unknownEmail = await context.request('/login', {
      method: 'POST', body: { email: 'desconhecida@udesc.br', senha: 'senha errada' },
    });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(await wrongPassword.json()).toEqual({ erro: 'credenciais inválidas' });
    expect(await unknownEmail.json()).toEqual({ erro: 'credenciais inválidas' });
  });

  it('rejeita sufixos após o limite de 72 bytes do bcrypt', async () => {
    const email = 'senha-limite@udesc.br';
    const senha = 'a'.repeat(72);
    await registerUser(context, email, senha);

    const extendedPassword = await context.request('/login', {
      method: 'POST', body: { email, senha: `${senha}sufixo` },
    });

    expect(extendedPassword.status).toBe(401);
    expect(await extendedPassword.json()).toEqual({ erro: 'credenciais inválidas' });
  });

  it('bloqueia após cinco falhas por conta e IP e libera após 15 minutos', async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await context.request('/login', {
        method: 'POST', body: { email: 'aluna@udesc.br', senha: 'senha errada' },
      });
      expect(response.status).toBe(401);
    }
    const blocked = await context.request('/login', {
      method: 'POST', body: { email: 'aluna@udesc.br', senha: 'Senha-segura-123' },
    });
    expect(blocked.status).toBe(429);

    context.clock.value += 15 * 60 * 1000;
    const afterWindow = await context.request('/login', {
      method: 'POST', body: { email: 'aluna@udesc.br', senha: 'senha errada' },
    });
    expect(afterWindow.status).toBe(401);
  });

  it('rotaciona refresh, invalida o antigo e revoga a família em caso de reuso', async () => {
    const login = await loginUser(context);
    const oldCookie = cookiePair(login);
    const refresh = await context.request('/auth/refresh', {
      method: 'POST', headers: { cookie: oldCookie },
    });
    expect(refresh.status).toBe(200);
    expect((await refresh.json()).accessToken).toBeTruthy();
    const newCookie = cookiePair(refresh);
    expect(newCookie).not.toBe(oldCookie);

    const replay = await context.request('/auth/refresh', {
      method: 'POST', headers: { cookie: oldCookie },
    });
    expect(replay.status).toBe(401);
    const familyRevoked = await context.request('/auth/refresh', {
      method: 'POST', headers: { cookie: newCookie },
    });
    expect(familyRevoked.status).toBe(401);
  });

  it('rejeita refresh ausente e revoga a sessão no logout', async () => {
    const missing = await context.request('/auth/refresh', { method: 'POST' });
    expect(missing.status).toBe(401);

    const login = await loginUser(context);
    const cookie = cookiePair(login);
    const logout = await context.request('/auth/logout', {
      method: 'POST', headers: { cookie },
    });
    expect(logout.status).toBe(204);
    expect(logout.headers.get('set-cookie')).toContain('refresh_token=;');
    expect(logout.headers.get('set-cookie')).toContain('Expires=Thu, 01 Jan 1970');

    const afterLogout = await context.request('/auth/refresh', {
      method: 'POST', headers: { cookie },
    });
    expect(afterLogout.status).toBe(401);
  });
});
