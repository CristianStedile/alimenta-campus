import { createHash, randomBytes, randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import jwt from 'jsonwebtoken';
import { LoginAttemptLimiter } from './login-limiter.js';

const ACCESS_TOKEN_SECONDS = 15 * 60;
const REFRESH_TOKEN_MILLISECONDS = 14 * 24 * 60 * 60 * 1000;
const REFRESH_COOKIE = 'refresh_token';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function passwordIsValid(password) {
  const characterCount = [...password].length;
  const byteCount = Buffer.byteLength(password, 'utf8');
  return characterCount >= 8 && byteCount <= 72;
}

function hashRefreshToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function errorResponse(res, status, message) {
  return res.status(status).json({ erro: message });
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/auth',
    maxAge: REFRESH_TOKEN_MILLISECONDS,
  };
}

function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/auth',
  });
}

function issueRefreshToken(db, usuarioId, familiaId, now) {
  const token = randomBytes(32).toString('base64url');
  db.prepare(`
    INSERT INTO refresh_tokens (usuario_id, token_hash, familia_id, expira_em, criado_em)
    VALUES (?, ?, ?, ?, ?)
  `).run(usuarioId, hashRefreshToken(token), familiaId, now + REFRESH_TOKEN_MILLISECONDS, now);
  return token;
}

function issueAccessToken(usuario, jwtSecret) {
  return jwt.sign(
    { sub: String(usuario.id) },
    jwtSecret,
    { algorithm: 'HS256', expiresIn: ACCESS_TOKEN_SECONDS },
  );
}

function createAuthMiddleware({ db, jwtSecret }) {
  return function requireAccessToken(req, res, next) {
    const authorization = req.get('authorization') ?? '';
    const match = authorization.match(/^Bearer\s+([^\s]+)$/i);
    if (!match) return errorResponse(res, 401, 'token ausente');

    try {
      const payload = jwt.verify(match[1], jwtSecret, { algorithms: ['HS256'] });
      const usuarioId = Number(payload.sub);
      if (!Number.isSafeInteger(usuarioId) || usuarioId <= 0) {
        return errorResponse(res, 401, 'token inválido ou expirado');
      }
      const usuario = db.prepare('SELECT id FROM usuarios WHERE id = ?').get(usuarioId);
      if (!usuario) return errorResponse(res, 401, 'token inválido ou expirado');
      req.usuario = usuario;
      return next();
    } catch {
      return errorResponse(res, 401, 'token inválido ou expirado');
    }
  };
}

export function createApp({
  db,
  jwtSecret,
  frontendOrigin = 'http://localhost:5173',
  now = Date.now,
  bcryptRounds = 12,
  loginMaxFailures = 5,
  loginWindowMs = 15 * 60 * 1000,
  logger = null,
} = {}) {
  if (!db) throw new Error('A conexão SQLite é obrigatória.');
  if (typeof jwtSecret !== 'string' || Buffer.byteLength(jwtSecret, 'utf8') < 32) {
    throw new Error('JWT_SECRET deve conter pelo menos 32 bytes.');
  }
  if (!Number.isInteger(bcryptRounds) || bcryptRounds < 10) {
    throw new Error('O custo bcrypt deve ser 10 ou superior.');
  }

  const app = express();
  const loginLimiter = new LoginAttemptLimiter({
    maxFailures: loginMaxFailures,
    windowMs: loginWindowMs,
    now,
  });
  const requireAccessToken = createAuthMiddleware({ db, jwtSecret });

  app.disable('x-powered-by');
  app.use(cors({
    origin: frontendOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));
  app.use(express.json({ limit: '10kb' }));
  app.use(cookieParser());

  app.post('/usuarios', async (req, res, next) => {
    try {
      const email = req.body?.email;
      const senha = req.body?.senha;
      if (typeof email !== 'string' || typeof senha !== 'string') {
        return errorResponse(res, 400, 'dados inválidos');
      }
      const emailNormalizado = normalizeEmail(email);
      if (!EMAIL_PATTERN.test(emailNormalizado) || !passwordIsValid(senha)) {
        return errorResponse(res, 400, 'dados inválidos');
      }

      const senhaHash = await bcrypt.hash(senha, bcryptRounds);
      try {
        const result = db.prepare(`
          INSERT INTO usuarios (email, email_normalizado, senha_hash)
          VALUES (?, ?, ?)
        `).run(emailNormalizado, emailNormalizado, senhaHash);
        return res.status(201).json({ id: Number(result.lastInsertRowid), email: emailNormalizado });
      } catch (error) {
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
          return errorResponse(res, 400, 'dados inválidos');
        }
        throw error;
      }
    } catch (error) {
      return next(error);
    }
  });

  app.post('/login', async (req, res, next) => {
    try {
      const email = req.body?.email;
      const senha = req.body?.senha;
      if (typeof email !== 'string' || typeof senha !== 'string' || !EMAIL_PATTERN.test(normalizeEmail(email))) {
        return errorResponse(res, 400, 'dados inválidos');
      }

      const emailNormalizado = normalizeEmail(email);
      const accountKey = `account:${emailNormalizado}`;
      const ipKey = `ip:${req.ip}`;
      const limiterKeys = [accountKey, ipKey];
      if (loginLimiter.isBlocked(limiterKeys)) {
        return errorResponse(res, 429, 'muitas tentativas');
      }

      const usuario = db.prepare(`
        SELECT id, email_normalizado, senha_hash
        FROM usuarios WHERE email_normalizado = ?
      `).get(emailNormalizado);
      const senhaConfere = usuario
        && Buffer.byteLength(senha, 'utf8') <= 72
        && await bcrypt.compare(senha, usuario.senha_hash);
      if (!senhaConfere) {
        loginLimiter.recordFailure(limiterKeys);
        return errorResponse(res, 401, 'credenciais inválidas');
      }

      loginLimiter.clear(limiterKeys);
      const nowValue = now();
      const familiaId = randomUUID();
      const refreshToken = issueRefreshToken(db, usuario.id, familiaId, nowValue);
      const accessToken = issueAccessToken(usuario, jwtSecret);
      res.cookie(REFRESH_COOKIE, refreshToken, cookieOptions());
      return res.json({ accessToken });
    } catch (error) {
      return next(error);
    }
  });

  app.post('/auth/refresh', (req, res, next) => {
    try {
      const token = req.cookies?.[REFRESH_COOKIE];
      if (!token) {
        clearRefreshCookie(res);
        return errorResponse(res, 401, 'sessão inválida ou expirada');
      }

      const tokenHash = hashRefreshToken(token);
      const savedToken = db.prepare(`
        SELECT id, usuario_id, familia_id, expira_em, revogado_em
        FROM refresh_tokens WHERE token_hash = ?
      `).get(tokenHash);
      if (!savedToken) {
        clearRefreshCookie(res);
        return errorResponse(res, 401, 'sessão inválida ou expirada');
      }

      const nowValue = now();
      if (savedToken.revogado_em !== null) {
        db.prepare('UPDATE refresh_tokens SET revogado_em = COALESCE(revogado_em, ?) WHERE familia_id = ?')
          .run(nowValue, savedToken.familia_id);
        clearRefreshCookie(res);
        return errorResponse(res, 401, 'sessão inválida ou expirada');
      }
      if (savedToken.expira_em <= nowValue) {
        db.prepare('UPDATE refresh_tokens SET revogado_em = ? WHERE id = ?').run(nowValue, savedToken.id);
        clearRefreshCookie(res);
        return errorResponse(res, 401, 'sessão inválida ou expirada');
      }

      const usuario = db.prepare('SELECT id FROM usuarios WHERE id = ?').get(savedToken.usuario_id);
      if (!usuario) {
        clearRefreshCookie(res);
        return errorResponse(res, 401, 'sessão inválida ou expirada');
      }

      const rotate = db.transaction(() => {
        db.prepare('UPDATE refresh_tokens SET revogado_em = ? WHERE id = ?').run(nowValue, savedToken.id);
        return issueRefreshToken(db, usuario.id, savedToken.familia_id, nowValue);
      });
      const newRefreshToken = rotate();
      res.cookie(REFRESH_COOKIE, newRefreshToken, cookieOptions());
      return res.json({ accessToken: issueAccessToken(usuario, jwtSecret) });
    } catch (error) {
      return next(error);
    }
  });

  app.post('/auth/logout', (req, res, next) => {
    try {
      const token = req.cookies?.[REFRESH_COOKIE];
      if (token) {
        const tokenHash = hashRefreshToken(token);
        db.prepare('UPDATE refresh_tokens SET revogado_em = COALESCE(revogado_em, ?) WHERE token_hash = ?')
          .run(now(), tokenHash);
      }
      clearRefreshCookie(res);
      return res.status(204).end();
    } catch (error) {
      return next(error);
    }
  });

  app.get('/pedidos', requireAccessToken, (req, res, next) => {
    try {
      const pedidos = db.prepare(`
        SELECT id, resumo, criado_em
        FROM pedidos WHERE usuario_id = ?
        ORDER BY criado_em DESC, id DESC
      `).all(req.usuario.id);
      return res.json(pedidos);
    } catch (error) {
      return next(error);
    }
  });

  app.get('/pedidos/:id', requireAccessToken, (req, res, next) => {
    try {
      const pedido = db.prepare('SELECT id, usuario_id, resumo, criado_em FROM pedidos WHERE id = ?')
        .get(req.params.id);
      if (!pedido) return errorResponse(res, 404, 'não encontrado');
      if (pedido.usuario_id !== req.usuario.id) return errorResponse(res, 403, 'sem permissão');
      const { usuario_id: _usuarioId, ...publicPedido } = pedido;
      return res.json(publicPedido);
    } catch (error) {
      return next(error);
    }
  });

  app.use((error, _req, res, _next) => {
    if (error instanceof SyntaxError && 'body' in error) {
      return errorResponse(res, 400, 'dados inválidos');
    }
    if (logger?.error) logger.error('Falha interna na API.');
    return errorResponse(res, 500, 'erro interno');
  });

  return app;
}
