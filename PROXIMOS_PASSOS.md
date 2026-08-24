# Próximos Passos — Sistema de Vendas Carvão Dois Irmãos

Atualizado em: 24/08/2026
Status atual: auditoria de segurança aplicada (RBAC, sessões em PG, migrations, CSRF timing-safe, paginação, testes, lint).

## 1. Subir o ambiente e testar ponta a ponta 🔴 (bloqueador)

- [x] Instalar/iniciar PostgreSQL local
- [ ] Corrigir credenciais no `.env` — a senha atual do `postgres` está sendo rejeitada (erro 28P01).
      Se necessário: `sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'nova_senha';"`
- [ ] Criar banco `carvao_dois_irmaos` (ver `.env.example`)
- [ ] Gerar `SESSION_SECRET`: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- [ ] **Aplicar schema:** `npm run migrate` (o app NÃO usa mais `sequelize.sync()`)
- [ ] Popular dados: `npm run seed`
- [ ] Iniciar: `npm start` → http://localhost:3000
- [ ] Testar fluxo completo: login → CRUDs → pedidos → relatório → logout

> ⚠️ Se o banco `carvao_dois_irmaos` já existia com tabelas criadas pelo antigo `sync()`,
> as migrations conflitarão ("relation already exists"). Para ambiente de dev, o caminho
> simples é recriar o banco: `DROP DATABASE` + `CREATE DATABASE` + `npm run migrate` + `npm run seed`.

## 2. Qualidade ✅

- [x] ESLint configurado (`npm run lint`)
- [x] Testes unitários com o runner nativo do Node (`npm test`) — regras de pedidos,
      CSRF, paginação e middleware de auth
- [ ] Cobertura de integração com banco de teste isolado (estoque, unicidade, CSRF ponta a ponta)

## 3. Documentar a API 🟡

- [ ] Swagger/OpenAPI para endpoints JSON (pedidos, status, relatório de vendas, busca)

## 4. Melhorias de produção 🟢

- [x] Sessões persistentes em PostgreSQL (connect-pg-simple)
- [x] RBAC: gestão de usuários restrita a admins (`requireRole('admin')`)
- [ ] Fazer push dos commits locais para `origin/main`

## 5. Deploy 🟢

- [ ] Escolher hospedagem (Render/Railway com Postgres gerenciado, ou VPS)
- [ ] Configurar variáveis de ambiente de produção (`NODE_ENV=production`, `SESSION_SECRET`, `DATABASE_URL`, SSL)
- [ ] Rodar `npm run migrate` no pipeline de deploy (nunca `sync()`)

## Mudanças da auditoria (24/08/2026)

| Achado | Correção |
|---|---|
| Sem verificação de papel | `requireRole('admin')` em `/users`; navbar já ocultava o link |
| Rate limit/cookies atrás de proxy | `app.set('trust proxy', 1)` |
| MemoryStore de sessão | `connect-pg-simple` com pool do próprio app |
| Schema via `sync()` | Migrations Sequelize + `npm run migrate` |
| CSRF não timing-safe | `crypto.timingSafeEqual` em `compararTokens` |
| Enumeração de usuários por timing | Hash dummy no login quando usuário não existe |
| Dinheiro em float | Cálculo em centavos (`utils/pedidoRules.js`) |
| Transições de status livres | Mapa `TRANSICOES_STATUS`; cancelamento devolve estoque |
| CSP com `'unsafe-inline'` em scripts | Removido (não há scripts inline nas views) |
| Sessão criada em visitas anônimas | Token CSRF sob demanda (login + área autenticada) |
| `:id` sem validação | `router.param('id', validarIdParam)` em todas as rotas |
| Listagens sem limite | Paginação (default 20, máx 50) + parcial de view |
| `body-parser` redundante / stack perdido na resposta de log | Dependência removida; erro completo logado no servidor |
| Seed com senha fixa em produção | Senha aleatória gerada e exibida uma única vez |
