# Sistema de Vendas — Carvão Dois Irmãos

Sistema de gerenciamento de clientes, produtos, categorias e pedidos desenvolvido com Node.js, Express e PostgreSQL (Sequelize ORM).

## Funcionalidades

- Autenticação com sessão (login/logout) e senhas com hash bcrypt
- CRUD de clientes, produtos, categorias e **pedidos** (interface web)
- API JSON de pedidos com transações e baixa automática de estoque
- Relatório de vendas por período (API JSON)
- Proteção CSRF, headers de segurança (helmet) e rate limiting

## Tecnologias Utilizadas

- **Node.js**: Ambiente de execução para JavaScript no lado do servidor.
- **Express**: Framework para construção de aplicativos web.
- **PostgreSQL + Sequelize**: Banco de dados relacional e ORM.
- **EJS**: Motor de visualização para renderizar páginas HTML.
- **Bootstrap**: Framework CSS para estilização das páginas.

## Instalação

### 1. Clone este Repositório

### 2. Instale as Dependências

```bash
npm install
```

### 3. Configure o Banco de Dados

Crie um banco PostgreSQL (por exemplo, `carvao_dois_irmaos`) e copie o `.env.example`:

```bash
cp .env.example .env
```

```bash
DB_HOST="localhost"
DB_USER="postgres"
DB_PASSWORD="sua_senha"
DB_NAME="carvao_dois_irmaos"
DB_PORT="5432"
NODE_ENV="development"
SESSION_SECRET="gere-um-segredo-aleatorio"
```

Gere um `SESSION_SECRET` de verdade com:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Em hospedagens gerenciadas (Render, Railway, RDS) basta uma `DATABASE_URL` — ela
tem precedência sobre as variáveis `DB_*` e `?sslmode=require` liga o TLS. Veja
todas as opções em `.env.example`.

### 4. Crie o schema, popule e execute

O schema vem das **migrations**; o app não usa mais `sequelize.sync()`:

```bash
createdb carvao_dois_irmaos
npm run migrate     # cria o schema
npm run seed        # dados de teste + usuário admin
npm start           # ou: node app.js
```

O servidor estará disponível em http://localhost:3000.

**Acesso padrão criado pelo seed:** usuário `admin`, senha `admin123` (altere após o primeiro login). Fora de `development` a senha é sorteada e exibida uma única vez.

## Rotas

As rotas de pedido atendem **HTML e JSON no mesmo path**. O formato é decidido
pelo cabeçalho `Accept`, e o `?format=html|json` serve para desfazer um empate
(clientes que não enviam cabeçalho, como um link aberto no navegador):

| Rota | Navegador | API (`Accept: application/json`) |
|---|---|---|
| `GET /pedidos` | lista com filtro por status e paginação | `{"pedidos": [...], "paginacao": {...}}` |
| `GET /pedidos/new` | formulário de novo pedido | — |
| `POST /pedidos` | cria a partir do formulário (302 para o pedido) | cria a partir de `{"cliente_id", "forma_pagamento", "itens": [...]}` (201) |
| `GET /pedidos/:id` | detalhe com itens e ações de status | detalhe em JSON |
| `PUT /pedidos/:id/status` | altera o status (formulário) | `{"status": "..."}` |
| `DELETE /pedidos/:id` | exclui (formulário) | exclui |
| `GET /pedidos/relatorio/vendas` | — (só JSON) | resumo e pedidos por período |

O formulário envia as linhas como `item_produto_id[]` e `item_quantidade[]`;
linhas em branco são ignoradas e o mesmo produto em duas linhas é somado antes
de validar o estoque.

## Qualidade

```bash
npm test          # suíte unitária + integração (precisa de PostgreSQL)
npm run lint      # ESLint
npm run lint:views# sintaxe dos templates EJS
```

A suíte de integração sobe o app de verdade em uma porta efêmera e fala HTTP
com `fetch`, sem dependência extra. Ela usa um banco separado
(`DB_NAME_TEST`) preparado pelo `pretest`, e é **omitida** — não quebrada —
quando o banco de teste não está disponível.

## Estrutura do Projeto

```
/TCC
├── /config          # Conexão com o banco (Sequelize) e config do CLI
├── /controllers     # Handlers das rotas (auth, clientes, produtos, pedidos…)
├── /middleware      # requireAuth, carregarUsuario e proteção CSRF
├── /migrations      # Schema do banco (fonte da verdade)
├── /models          # Modelos Sequelize
├── /routes          # Definição das rotas
├── /scripts         # Utilitários (setup do banco de teste)
├── /seeds           # Popular banco com dados de teste
├── /services        # Regras de escrita de pedido (compartilhadas por API e web)
├── /utils           # Helpers (respostas, regras, paginação, limites, formatação)
├── /tests           # Testes unitários e de integração
├── /views           # Templates EJS
├── app.js           # Aplicação principal
└── package.json
```

`database_postgres.sql` é apenas um instantâneo do schema, para conferência.
Não edite à mão e não o use para criar o banco: use `npm run migrate`.

## Licença

Este projeto é licenciado sob a ISC License.
