import bcrypt from 'bcrypt';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestContext } from './helpers.js';

describe('POST /usuarios', () => {
  let context;

  beforeEach(async () => {
    context = await createTestContext();
  });

  afterEach(async () => {
    await context.close();
  });

  it('cria usuário com e-mail normalizado e bcrypt sem devolver hash ou senha', async () => {
    const senha = 'Senha-segura-123';
    const response = await context.request('/usuarios', {
      method: 'POST',
      body: { email: '  Aluna@UDESC.BR ', senha },
    });

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body).toMatchObject({ id: expect.any(Number), email: 'aluna@udesc.br' });
    expect(JSON.stringify(body)).not.toContain(senha);
    expect(JSON.stringify(body)).not.toMatch(/senha_hash|password_hash/i);

    const usuario = context.db.prepare('SELECT email_normalizado, senha_hash FROM usuarios').get();
    expect(usuario.email_normalizado).toBe('aluna@udesc.br');
    expect(usuario.senha_hash).not.toBe(senha);
    expect(await bcrypt.compare(senha, usuario.senha_hash)).toBe(true);
  });

  it('usa custo bcrypt 12 por padrão', async () => {
    const contextWithDefaultCost = await createTestContext({ bcryptRounds: undefined });
    try {
      const response = await contextWithDefaultCost.request('/usuarios', {
        method: 'POST',
        body: { email: 'custo@udesc.br', senha: 'Senha-segura-123' },
      });
      expect(response.status).toBe(201);
      const hash = contextWithDefaultCost.db.prepare('SELECT senha_hash FROM usuarios').get().senha_hash;
      expect(bcrypt.getRounds(hash)).toBe(12);
    } finally {
      await contextWithDefaultCost.close();
    }
  });

  it('rejeita campos inválidos e senhas fora do limite com 400', async () => {
    const invalidBodies = [
      {},
      { email: 'email-inválido', senha: 'Senha-segura-123' },
      { email: 'a@udesc.br', senha: 'curta' },
      { email: 'b@udesc.br', senha: '😀'.repeat(19) },
    ];

    for (const body of invalidBodies) {
      const response = await context.request('/usuarios', { method: 'POST', body });
      expect(response.status).toBe(400);
    }
  });

  it('rejeita e-mail duplicado após normalização com 400', async () => {
    const first = await context.request('/usuarios', {
      method: 'POST', body: { email: 'aluna@udesc.br', senha: 'Senha-segura-123' },
    });
    const second = await context.request('/usuarios', {
      method: 'POST', body: { email: ' ALUNA@UDESC.BR ', senha: 'Outra-senha-123' },
    });

    expect(first.status).toBe(201);
    expect(second.status).toBe(400);
    expect(context.db.prepare('SELECT COUNT(*) AS total FROM usuarios').get().total).toBe(1);
  });
});
