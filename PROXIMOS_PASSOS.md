# Próximos Passos — Sistema de Vendas Carvão Dois Irmãos

Atualizado em: 24/08/2026
Status atual: migração PostgreSQL/Sequelize concluída; auth, CSRF e segurança commitados.

## 1. Subir o ambiente e testar ponta a ponta 🔴 (bloqueador)

- [ ] Instalar/iniciar PostgreSQL local (atualmente `ECONNREFUSED 127.0.0.1:5432`)
- [ ] Criar banco `carvao_dois_irmaos` e configurar credenciais no `.env` (ver `.env.example`)
- [ ] Gerar `SESSION_SECRET`: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- [ ] Popular dados: `node seeds/seedDatabase.js`
- [ ] Iniciar: `npm start` → http://localhost:3000
- [ ] Testar fluxo completo: login (admin/admin123) → CRUDs → pedidos → relatório → logout

## 2. Testes automatizados 🟡

- [ ] Configurar Jest + banco de teste isolado (SQLite in-memory ou Postgres dedicado)
- [ ] Cobrir validações críticas:
  - estoque não pode ficar negativo
  - email/documento únicos por cliente
  - baixa e recuperação automática de estoque em pedidos
  - bloqueio de rotas sem login (requireAuth) e sem token CSRF

## 3. Documentar a API 🟡

- [ ] Swagger/OpenAPI para endpoints JSON (pedidos, status, relatório de vendas, busca)

## 4. Melhorias de produção 🟢

- [ ] Sessões persistentes (substituir MemoryStore — ex.: connect-pg-simple)
- [ ] Fazer push dos commits locais para `origin/main`

## 5. Deploy 🟢

- [ ] Escolher hospedagem (Render/Railway com Postgres gerenciado, ou VPS)
- [ ] Configurar variáveis de ambiente de produção (`NODE_ENV=production`, `SESSION_SECRET`, SSL)
