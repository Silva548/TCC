# Sistema de Vendas — Carvão Dois Irmãos

Sistema de gerenciamento de clientes, produtos, categorias e pedidos desenvolvido com Node.js, Express e PostgreSQL (Sequelize ORM).

## Funcionalidades

- Autenticação com sessão (login/logout) e senhas com hash bcrypt
- CRUD de clientes, produtos e categorias (interface web)
- API JSON de pedidos com transações e baixa automática de estoque
- Relatório de vendas por período
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

Crie um banco PostgreSQL (por exemplo, `carvao_dois_irmaos`), copie o arquivo `.env` de exemplo e ajuste as credenciais:

```
DB_HOST="localhost"
DB_USER="postgres"
DB_PASSWORD="sua_senha"
DB_NAME="carvao_dois_irmaos"
DB_PORT="5432"
NODE_ENV="development"
SESSION_SECRET="gere-um-segredo-aleatorio"
```

As tabelas podem ser criadas com `database_postgres.sql` ou automaticamente pelo `sequelize.sync()` ao iniciar.

### 4. Popule o banco e execute

```bash
node seeds/seedDatabase.js   # cria dados de teste + usuário admin
npm start                    # ou: node app.js
```

O servidor estará disponível em http://localhost:3000.

**Acesso padrão criado pelo seed:** usuário `admin`, senha `admin123` (altere após o primeiro login).

## Estrutura do Projeto

```
/TCC
├── /config        # Conexão com o banco (Sequelize)
├── /controllers   # Regras das rotas (auth, clientes, produtos, etc.)
├── /middleware    # requireAuth e proteção CSRF
├── /models        # Modelos Sequelize
├── /routes        # Definição das rotas
├── /seeds         # Popular banco com dados de teste
├── /views         # Templates EJS
├── app.js         # Aplicação principal
└── package.json
```

## Licença

Este projeto é licenciado sob a ISC License.
