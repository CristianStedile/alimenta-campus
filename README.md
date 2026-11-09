# Alimenta Campus

O Alimenta Campus é uma proposta de plataforma para facilitar o acesso à alimentação no campus. A ideia reúne o cardápio do dia, os pedidos e a carteira com créditos e recargas em uma experiência simples para estudantes.

O repositório começou como um protótipo de interface. As telas originais continuam disponíveis em `prototipos/`; a aplicação atual inicia a implementação do projeto real com autenticação e uma área protegida de pedidos.

## Estado atual

- Cadastro de usuários pela API, com e-mail único e senha protegida com bcrypt.
- Login com access token JWT de curta duração e refresh token em cookie `HttpOnly`, `Secure` e `SameSite=Strict`.
- Renovação rotativa de sessão, logout e proteção contra reutilização de refresh token.
- Página React de login e área autenticada “Meus pedidos”.
- Rotas de pedidos limitadas ao usuário autenticado, com verificação de posse.
- O fluxo completo de cardápio, recarga e criação de pedidos ainda permanece nos protótipos.

## Organização

| Pasta/arquivo | Conteúdo |
| --- | --- |
| `prototipos/` | Telas HTML, CSS, JavaScript e imagens do protótipo original. |
| `frontend/` | Aplicação React com Vite. |
| `backend/` | API Express, autenticação e persistência SQLite. |
| `scripts/` | Verificação de integridade dos caminhos locais dos protótipos. |

## Requisitos

- Node.js 22.12 ou superior.
- npm.

## Configuração local

Na raiz do projeto, instale as dependências:

```powershell
npm install
```

Se ainda não existir, crie `backend/.env` a partir do exemplo:

```powershell
Copy-Item backend/.env.example backend/.env
```

Gere um segredo aleatório para `JWT_SECRET` e substitua o valor de exemplo no arquivo `backend/.env`:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

Mantenha esse segredo privado. Arquivos `.env` e o banco SQLite local são ignorados pelo Git. A configuração padrão usa a API em `http://localhost:3000`, a interface em `http://localhost:5173` e cria o banco em `backend/data/alimenta-campus.sqlite`.

Inicie os serviços em terminais separados, ambos na raiz do projeto:

```powershell
npm run dev:backend
```

```powershell
npm run dev:frontend
```

Abra `http://localhost:5173` no navegador. Se a API estiver em outro endereço, ajuste `VITE_API_URL` usando `frontend/.env.example` como referência.

## Criar uma conta

A tela de cadastro não faz parte desta etapa. Para criar uma conta local, envie `email` e `senha` para `POST /usuarios`. A senha deve ter entre 8 e 72 bytes.

```powershell
$body = @{
  email = 'voce@exemplo.com'
  senha = 'SuaSenhaComMaisDe8Caracteres'
} | ConvertTo-Json

Invoke-RestMethod `
  -Method Post `
  -Uri 'http://localhost:3000/usuarios' `
  -ContentType 'application/json' `
  -Body $body
```

Depois, entre pela tela de login. O access token fica somente em memória; ao recarregar a aplicação, a sessão é restaurada pelo cookie de refresh.

## API disponível

| Método e rota | Descrição |
| --- | --- |
| `POST /usuarios` | Cadastra usuário; retorna `400` para dados inválidos ou e-mail duplicado. |
| `POST /login` | Valida credenciais e retorna o access token; credenciais incorretas retornam erro genérico `401`. |
| `POST /auth/refresh` | Renova o access token e rotaciona o refresh token. |
| `POST /auth/logout` | Revoga a sessão e limpa o cookie. |
| `GET /pedidos` | Lista somente os pedidos do usuário autenticado. |
| `GET /pedidos/:id` | Consulta um pedido próprio; retorna `403` se pertencer a outra conta e `404` se não existir. |

As rotas protegidas recebem `Authorization: Bearer <accessToken>`. O login permite até cinco falhas por e-mail e por IP em uma janela de 15 minutos; novas tentativas durante o bloqueio recebem `429`.

## Testes e build

Na raiz do projeto:

```powershell
npm test
npm run build
```

Os testes cobrem cadastro, hash de senha, login, expiração e rotação de tokens, limitação de tentativas, logout, autorização por posse, renovação de sessão na interface e caminhos dos protótipos.

## Segurança e limites do MVP

- As senhas são armazenadas com bcrypt e custo 12; senhas acima de 72 bytes são rejeitadas no login.
- O access token expira em 15 minutos. O refresh token dura 14 dias, é armazenado no banco somente como hash SHA-256 e enviado em cookie seguro.
- O limitador de tentativas e o banco SQLite atendem ao MVP local de uma única instância. Para escalar a API, o limitador deve usar armazenamento compartilhado.
- Não registre senhas, cookies ou tokens. Em deploy, use HTTPS e configure um `JWT_SECRET` aleatório e privado.
- Recuperação de senha, cadastro pela interface, fluxo completo de pedidos e recargas, e deploy ainda não estão implementados.
