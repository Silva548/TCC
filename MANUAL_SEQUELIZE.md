# 🔥 Sistema de Vendas - Carvão Vegetal Dois Irmãos

Sistema de gerenciamento de vendas online para Carvão Vegetal, desenvolvido com **Node.js**, **Express** e **Sequelize ORM** com **PostgreSQL**.

## 📋 Estrutura do Projeto

```
.
├── config/
│   └── db.js                           # Configuração do Sequelize com PostgreSQL
├── models/
│   ├── index.js                        # Índice de modelos e sincronização
│   ├── clienteModel.js                 # Modelo de Cliente (B2C/B2B)
│   ├── produtoSequelizeModel.js        # Modelo de Produto (Carvão)
│   ├── pedidoModel.js                  # Modelo de Pedido
│   └── itemPedidoModel.js              # Modelo de Item do Pedido
├── controllers/
│   ├── clienteSequelizeController.js   # Controller de Cliente
│   └── produtoSequelizeController.js   # Controller de Produto
├── routes/
│   ├── clienteRoutes.js                # Rotas de Cliente
│   └── produtoSequelizeRoutes.js       # Rotas de Produto
├── app.js                              # Arquivo principal da aplicação
├── package.json                        # Dependências do projeto
├── .env                                # Variáveis de ambiente
└── database_postgres.sql               # Estrutura SQL (referência)
```

## 🚀 Instalação e Configuração

### 1. Pré-requisitos

- Node.js v14+
- PostgreSQL instalado e rodando
- npm ou yarn

### 2. Instalar Dependências

```bash
npm install
```

### 3. Configurar o Banco de Dados

#### Opção A: Criar banco manualmente
```sql
CREATE DATABASE carvao_dois_irmaos;
```

#### Opção B: Usar o arquivo SQL (opcional)
```bash
psql -U postgres -d carvao_dois_irmaos -f database_postgres.sql
```

### 4. Configurar Variáveis de Ambiente

Edite o arquivo `.env`:

```env
DB_HOST="localhost"
DB_USER="seu_usuario_postgres"
DB_PASSWORD="sua_senha_postgres"
DB_NAME="carvao_dois_irmaos"
DB_PORT="5432"
NODE_ENV="development"
```

### 5. Iniciar Aplicação

```bash
# Modo desenvolvimento (com nodemon)
npm run dev

# Modo produção
npm start
```

A aplicação estará disponível em `http://localhost:3000`

## 📊 Modelos de Dados

### Cliente
```javascript
{
  id: Integer (PK),
  nome: String,
  email: String (UNIQUE),
  senha: String (bcrypt),
  documento: String (CPF/CNPJ, UNIQUE),
  telefone: String,
  tipo: ENUM('B2C', 'B2B'),
  createdAt: Date,
  updatedAt: Date
}
```

### Produto
```javascript
{
  id: Integer (PK),
  nome: String,
  descricao: Text,
  preco: Decimal,
  peso_kg: Decimal,
  estoque: Integer,
  createdAt: Date,
  updatedAt: Date
}
```

### Pedido
```javascript
{
  id: Integer (PK),
  cliente_id: Integer (FK -> Cliente),
  data: Date,
  status: ENUM('pendente', 'processando', 'enviado', 'entregue', 'cancelado'),
  valor_total: Decimal,
  forma_pagamento: ENUM('credito', 'debito', 'pix', 'boleto', 'dinheiro'),
  createdAt: Date,
  updatedAt: Date
}
```

### ItemPedido
```javascript
{
  id: Integer (PK),
  pedido_id: Integer (FK -> Pedido),
  produto_id: Integer (FK -> Produto),
  quantidade: Integer,
  preco_unitario: Decimal,
  createdAt: Date,
  updatedAt: Date
}
```

## 🔗 Associações

- **Cliente** → Pedido (1:N)
- **Pedido** → ItemPedido (1:N)
- **Produto** → ItemPedido (1:N)

## 📡 Rotas da API

### Clientes
```
GET    /clientes                # Listar todos
GET    /clientes/new            # Formulário criar
POST   /clientes                # Criar
GET    /clientes/search         # Buscar por nome
GET    /clientes/:id            # Obter um
GET    /clientes/:id/edit       # Formulário editar
PUT    /clientes/:id            # Atualizar
DELETE /clientes/:id            # Deletar
```

### Produtos
```
GET    /produtos                # Listar todos
GET    /produtos/new            # Formulário criar
POST   /produtos                # Criar
GET    /produtos/:id            # Obter um
GET    /produtos/:id/edit       # Formulário editar
PUT    /produtos/:id            # Atualizar (com validação de estoque)
DELETE /produtos/:id            # Deletar
```

## ⚠️ Validações Importantes

### Produtos
- **Estoque não negativo**: O sistema impede que o estoque fique negativo ao atualizar
- **Preço válido**: Precisa ser um valor decimal positivo
- **Peso obrigatório**: Todo produto deve ter peso em kg

### Clientes
- **Email único**: Não permite emails duplicados
- **Documento único**: CPF/CNPJ devem ser únicos
- **Senha criptografada**: Usa bcrypt com salt 10

## 🔄 Como Sincronizar o Banco

No seu `app.js`, adicione:

```javascript
const { syncDatabase } = require('./models/index');

// Sincronizar banco (criar tabelas automaticamente)
syncDatabase(false).then(() => {
    app.listen(3000, () => {
        console.log('Server running on port 3000');
    });
});
```

## 📝 Exemplos de Uso

### Criar um Produto
```bash
POST /produtos
Content-Type: application/json

{
  "nome": "Carvão Vegetal 5kg",
  "descricao": "Carvão premium para churrasco",
  "preco": 45.00,
  "peso_kg": 5.0,
  "estoque": 100
}
```

### Criar um Cliente
```bash
POST /clientes
Content-Type: application/json

{
  "nome": "João Silva",
  "email": "joao@email.com",
  "senha": "senha123",
  "documento": "12345678901",
  "telefone": "11999999999",
  "tipo": "B2C"
}
```

### Criar um Pedido
```bash
POST /pedidos
Content-Type: application/json

{
  "cliente_id": 1,
  "valor_total": 135.00,
  "forma_pagamento": "pix"
}
```

## 🛠️ Dependências Principais

- **express** - Framework web
- **sequelize** - ORM para Node.js
- **pg** - Driver PostgreSQL
- **bcrypt** - Criptografia de senhas
- **dotenv** - Variáveis de ambiente
- **ejs** - Template engine
- **method-override** - Suporte a PUT/DELETE em formulários HTML
- **body-parser** - Parsing de corpo de requisições

## 📧 Contato

Sistema desenvolvido para **Carvão Vegetal Dois Irmãos**

---

**Nota**: As tabelas são criadas automaticamente pelo Sequelize na primeira sincronização. O arquivo `database_postgres.sql` é apenas para referência.
