import jwt from 'jsonwebtoken';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, loginUser, registerUser, TEST_JWT_SECRET } from './helpers.js';

describe('rotas de pedidos protegidas', () => {
  let context;
  let aluna;
  let colega;
  let tokenAluna;
  let tokenColega;

  beforeEach(async () => {
    context = await createTestContext();
    aluna = await registerUser(context, 'aluna@udesc.br');
    colega = await registerUser(context, 'colega@udesc.br');
    tokenAluna = (await (await loginUser(context, 'aluna@udesc.br')).json()).accessToken;
    tokenColega = (await (await loginUser(context, 'colega@udesc.br')).json()).accessToken;
    context.db.prepare('INSERT INTO pedidos (id, usuario_id, resumo) VALUES (?, ?, ?)')
      .run('AC-101', aluna.id, 'Pedido da aluna');
    context.db.prepare('INSERT INTO pedidos (id, usuario_id, resumo) VALUES (?, ?, ?)')
      .run('AC-102', colega.id, 'Pedido da colega');
  });

  afterEach(async () => {
    await context.close();
  });

  it('retorna 401 sem token, com token inválido ou expirado', async () => {
    const absent = await context.request('/pedidos');
    const invalid = await context.request('/pedidos', {
      headers: { authorization: 'Bearer token-inválido' },
    });
    const expiredToken = jwt.sign(
      { sub: String(aluna.id), exp: Math.floor(Date.now() / 1000) - 1 },
      TEST_JWT_SECRET,
      { algorithm: 'HS256' },
    );
    const expired = await context.request('/pedidos', {
      headers: { authorization: `Bearer ${expiredToken}` },
    });

    expect(absent.status).toBe(401);
    expect(invalid.status).toBe(401);
    expect(expired.status).toBe(401);
  });

  it('lista somente os pedidos do usuário autenticado', async () => {
    const response = await context.request('/pedidos', {
      headers: { authorization: `Bearer ${tokenAluna}` },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([
      expect.objectContaining({ id: 'AC-101', resumo: 'Pedido da aluna' }),
    ]);
  });

  it('permite o pedido próprio e retorna 403 para pedido de outra pessoa', async () => {
    const own = await context.request('/pedidos/AC-101', {
      headers: { authorization: `Bearer ${tokenAluna}` },
    });
    const another = await context.request('/pedidos/AC-102', {
      headers: { authorization: `Bearer ${tokenAluna}` },
    });
    const absent = await context.request('/pedidos/inexistente', {
      headers: { authorization: `Bearer ${tokenAluna}` },
    });

    expect(own.status).toBe(200);
    expect(another.status).toBe(403);
    expect(await another.json()).toEqual({ erro: 'sem permissão' });
    expect(absent.status).toBe(404);
    expect(tokenColega).toBeTruthy();
  });
});
