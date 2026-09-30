# Rodando a Aplicação Localmente

Guia para subir o sistema de vendas Carvão Dois Irmãos em ambiente de desenvolvimento/testes.

## Pré-requisitos

- **Node.js** 18 ou superior (testado com v24)
- **PostgreSQL** 14 ou superior, em execução local
- npm (vem com o Node)

Verifique a instalação:

```bash
node --version
psql --version
pg_isready   # deve responder: accepting connections
```

## 1. Instalar dependências

```bash
npm install
```

## 2. Configurar variáveis de ambiente

Copie o exemplo e edite com suas credenciais:

```bash
cp .env.example .env
```

Conteúdo do `.env`:

```env
DB_HOST="localhost"
DB_USER="postgres"
DB_PASSWORD="sua_senha_do_postgres"
DB_NAME="carvao_dois_irmaos"
DB_PORT="5432"
NODE_ENV="development"
SESSION_SECRET="<saída do comando abaixo>"
```

Gere um `SESSION_SECRET` aleatório:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

> Se o Postgres recusar a senha (`error 28P01`), redefina:
> `sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'sua_senha';"`

## 3. Criar o banco de dados

```bash
createdb -h localhost -U postgres carvao_dois_irmaos
```

Ou via psql: `CREATE DATABASE carvao_dois_irmaos;`

## 4. Aplicar o schema (migrations)

O app **não usa mais `sequelize.sync()`** — o schema vem das migrations:

```bash
npm run migrate
```

Comandos auxiliares:

```bash
npm run migrate:status   # lista migrations pendentes/aplicadas
npm run migrate:undo     # desfaz a última migration
```

## 5. Popular dados de teste (seed)

Cria usuário admin, categorias, clientes e produtos de exemplo:

```bash
npm run seed
```

Em `development`, o login do admin é fixo: **admin / admin123**
(em produção a senha é gerada aleatoriamente e exibida uma única vez).

## 6. Iniciar a aplicação

```bash
npm start        # produção/simples
npm run dev      # desenvolvimento com auto-reload (nodemon)
```

Acesse **http://localhost:3000** e faça login.

## 7. Testes e qualidade

```bash
npm test         # testes unitários (runner nativo do Node)
npm run lint     # ESLint
```

## Comandos rápidos (resumo)

```bash
npm install
cp .env.example .env    # editar credenciais + SESSION_SECRET
createdb -h localhost -U postgres carvao_dois_irmaos
npm run migrate
npm run seed
npm start
```

## Solução de problemas

| Problema | Causa provável | Solução |
|---|---|---|
| `password authentication failed` (28P01) | Senha no `.env` incorreta | `ALTER USER postgres PASSWORD ...` |
| `database "carvao_dois_irmaos" does not exist` | Banco não criado | Passo 3 |
| `relation "usuarios/tabela" does not exist` | Migrations não aplicadas | Passo 4 (`npm run migrate`) |
| `relation "xxx" already exists` ao migrar | Banco antigo criado pelo antigo `sync()` | Recriar o banco: `DROP DATABASE` + passo 3 e 4 |
| Porta 3000 ocupada | Outro processo usando | `PORT=3001 npm start` |
| Login não funciona após seed | Seed já tinha rodado antes | Admin já existia; senha continua `admin123` (dev) |

## O que está protegido

- Todas as rotas abaixo de `/produtos`, `/categorias`, `/clientes`, `/pedidos` exigem login
- `/users` exige papel **admin**
- Formulários exigem token CSRF; POST sem token retorna 403
- Rate limit: 300 req/15min global, 10 tentativas de login/15min
