import { once } from 'node:events';
import { createApp } from '../src/app.js';
import { createDatabase } from '../src/database.js';

export const TEST_JWT_SECRET = 'test-only-secret-with-at-least-32-bytes';

export async function createTestContext(options = {}) {
  const clock = { value: Date.now() };
  const db = createDatabase(':memory:');
  const app = createApp({
    db,
    jwtSecret: TEST_JWT_SECRET,
    frontendOrigin: 'http://localhost:5173',
    now: () => clock.value,
    bcryptRounds: 10,
    loginMaxFailures: 5,
    loginWindowMs: 15 * 60 * 1000,
    ...options,
  });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  return {
    app,
    db,
    clock,
    baseUrl,
    async request(route, { body, headers, ...options } = {}) {
      const requestHeaders = new Headers(headers);
      if (body !== undefined && !requestHeaders.has('content-type')) {
        requestHeaders.set('content-type', 'application/json');
      }
      return fetch(`${baseUrl}${route}`, {
        ...options,
        headers: requestHeaders,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    },
    async close() {
      await new Promise((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
      });
      db.close();
    },
  };
}

export async function registerUser(context, email = 'aluna@udesc.br', senha = 'Senha-segura-123') {
  const response = await context.request('/usuarios', {
    method: 'POST',
    body: { email, senha },
  });
  if (!response.ok) throw new Error(`cadastro falhou com ${response.status}`);
  return response.json();
}

export async function loginUser(context, email = 'aluna@udesc.br', senha = 'Senha-segura-123') {
  const response = await context.request('/login', {
    method: 'POST',
    body: { email, senha },
  });
  if (!response.ok) throw new Error(`login falhou com ${response.status}`);
  return response;
}

export function cookiePair(response) {
  const setCookie = response.headers.get('set-cookie');
  if (!setCookie) throw new Error('resposta não definiu cookie');
  return setCookie.split(';', 1)[0];
}
