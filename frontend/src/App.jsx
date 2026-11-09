import { useEffect, useState } from 'react';
import { apiRequest, clearAccessToken, login, logout, refreshAccessToken } from './api.js';
import './styles.css';

function LoginView({ onAuthenticated }) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await login(email, senha);
      await onAuthenticated();
    } catch (requestError) {
      if (requestError.status === 401) setError('E-mail ou senha inválidos.');
      else if (requestError.status === 429) setError('Muitas tentativas. Aguarde 15 minutos para tentar novamente.');
      else setError('Não foi possível conectar à API. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-layout">
      <section className="login-brand" aria-label="Alimenta Campus">
        <img className="brand-logo" src="/img/logo-alimenta-campus.png" alt="Alimenta Campus — UDESC" />
        <p>Alimentação universitária mais simples, todos os dias.</p>
      </section>
      <section className="login-card" aria-labelledby="login-title">
        <h1 id="login-title">Bem-vindo(a)!</h1>
        <p className="login-subtitle">Faça o login para continuar</p>
        <form className="login-form" onSubmit={handleSubmit}>
          <label htmlFor="email">E-mail</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            placeholder="seu.email@udesc.br"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <label htmlFor="senha">Senha</label>
          <div className="password-field">
            <input
              id="senha"
              name="senha"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Digite sua senha"
              value={senha}
              onChange={(event) => setSenha(event.target.value)}
              required
            />
            <button type="button" className="show-password" onClick={() => setShowPassword((value) => !value)}>
              {showPassword ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>
          {error && <p role="alert" className="form-error">{error}</p>}
          <button className="primary-button" type="submit" disabled={submitting}>
            {submitting ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
        <p className="login-footnote">Acesso de demonstração do Alimenta Campus.</p>
      </section>
    </main>
  );
}

function OrdersView({ orders, onLogout }) {
  return (
    <main className="orders-shell">
      <header className="orders-header">
        <img className="orders-logo" src="/img/logo-alimenta-campus.png" alt="Alimenta Campus" />
        <button type="button" className="logout-button" onClick={onLogout}>Sair</button>
      </header>
      <section className="orders-content" aria-labelledby="orders-title">
        <p className="eyebrow">Área do estudante</p>
        <h1 id="orders-title">Meus pedidos</h1>
        <p className="orders-intro">Seus pedidos vinculados à sua conta aparecem aqui.</p>
        {orders.length === 0 ? (
          <div className="empty-state">Você ainda não possui pedidos.</div>
        ) : (
          <ul className="orders-list">
            {orders.map((order) => (
              <li className="order-row" key={order.id}>
                <div>
                  <strong>{order.id}</strong>
                  <span>{order.resumo}</span>
                </div>
                <time>{order.criado_em}</time>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [orders, setOrders] = useState([]);

  async function loadOrders() {
    const result = await apiRequest('/pedidos');
    setOrders(Array.isArray(result) ? result : []);
  }

  useEffect(() => {
    let active = true;
    refreshAccessToken()
      .then(async (token) => {
        if (!active || !token) return;
        await loadOrders();
        if (active) setAuthenticated(true);
      })
      .catch(() => {
        clearAccessToken();
        if (active) setAuthenticated(false);
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => { active = false; };
  }, []);

  async function handleAuthenticated() {
    await loadOrders();
    setAuthenticated(true);
  }

  async function handleLogout() {
    try {
      await logout();
    } finally {
      clearAccessToken();
      setAuthenticated(false);
      setOrders([]);
    }
  }

  if (!ready) {
    return <main className="loading-screen" aria-live="polite">Carregando sessão…</main>;
  }
  if (!authenticated) return <LoginView onAuthenticated={handleAuthenticated} />;
  return <OrdersView orders={orders} onLogout={handleLogout} />;
}
