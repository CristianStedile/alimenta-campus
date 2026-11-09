# Usar a coleção no Postman

1. Inicie a API seguindo a seção de configuração do [README principal](../README.md).
2. No Postman, importe `Alimenta Campus - Local.postman_collection.json` e `Alimenta Campus - Local.postman_environment.json`.
3. Selecione o ambiente **Alimenta Campus - Local** e ajuste `email` e `senha` para a conta local que será usada.
4. Envie `01 — Cadastro / Cadastrar usuário` uma vez para criar a conta, ou use os dados de uma conta existente.
5. Envie `02 — Login / Login`. O script salva `accessToken` no ambiente; o cookie `refresh_token` é mantido na cookie jar para as chamadas `/auth`.
6. Chame as rotas da pasta `03 — Pedidos`. Use `04 — Renovação e logout / Renovar sessão` para testar a rotação do refresh token e `Logout` para encerrar a sessão.

A coleção também traz exemplos de cadastro inválido ou duplicado, login inválido, pedido inexistente, token inválido, chamada protegida sem token e refresh sem cookie. O login inválido conta como uma falha; cinco falhas para o mesmo e-mail e IP em 15 minutos acionam o bloqueio temporário.

Os valores `pedidoProprio` e `pedidoAlheio` são exemplos. A API ainda não tem rota para criar pedidos; para ver `200` e `403` nesses exemplos, os IDs precisam existir no SQLite e pertencer, respectivamente, à conta autenticada e a outra conta. Sem esses registros, a resposta esperada é `404`.
