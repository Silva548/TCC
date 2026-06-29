#!/usr/bin/env node

// Arquivo de instruções - LEIA ISSO PRIMEIRO!

console.log(`
╔════════════════════════════════════════════════════════════════════╗
║                                                                    ║
║  🔥 SISTEMA DE VENDAS - CARVÃO VEGETAL DOIS IRMÃOS 🔥            ║
║                                                                    ║
║  Migração de MySQL com Callback -> PostgreSQL com Sequelize      ║
║                                                                    ║
╚════════════════════════════════════════════════════════════════════╝

📦 ARQUIVOS CRIADOS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ CONFIGURAÇÃO:
   • config/db.js - Conexão com PostgreSQL usando Sequelize
   • .env - Variáveis de ambiente (ATUALIZE COM SUAS CREDENCIAIS!)
   • package.json - Dependências atualizadas (postgres, sequelize, bcrypt)

✅ MODELOS SEQUELIZE:
   • models/index.js - Arquivo principal com todas as associações
   • models/clienteModel.js - Modelo Cliente (B2C/B2B)
   • models/produtoSequelizeModel.js - Modelo Produto (Carvão)
   • models/pedidoModel.js - Modelo Pedido
   • models/itemPedidoModel.js - Modelo ItemPedido

✅ CONTROLLERS (COM MÉTODOS ASYNC/AWAIT):
   • controllers/clienteSequelizeController.js - CRUD de Clientes
   • controllers/produtoSequelizeController.js - CRUD de Produtos (com validação de estoque)
   • controllers/pedidoController.js - CRUD de Pedidos + relatório de vendas

✅ ROTAS:
   • routes/clienteRoutes.js - Endpoints de clientes
   • routes/produtoSequelizeRoutes.js - Endpoints de produtos
   • routes/pedidoRoutes.js - Endpoints de pedidos

✅ UTILITÁRIOS:
   • seeds/seedDatabase.js - Dados de teste
   • app-exemplo.js - Exemplo de como configurar o app.js
   • database_postgres.sql - Schema SQL (referência)
   • MANUAL_SEQUELIZE.md - Documentação completa

🚀 PRÓXIMOS PASSOS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1️⃣ INSTALAR DEPENDÊNCIAS:
   npm install

2️⃣ CONFIGURAR POSTGRESQL:
   
   a) Criar banco de dados:
      psql -U postgres -c "CREATE DATABASE carvao_dois_irmaos;"
   
   b) EDITAR .env com suas credenciais:
      DB_HOST="localhost"
      DB_USER="seu_usuario_postgres"
      DB_PASSWORD="sua_senha"
      DB_NAME="carvao_dois_irmaos"
      DB_PORT="5432"

3️⃣ INICIALIZAR APP:
   
   a) Copiar exemplo para arquivo real:
      cp app-exemplo.js app.js
   
   b) Ajustar as rotas no app.js conforme necessário
   
   c) Iniciar servidor:
      npm run dev

4️⃣ (OPCIONAL) POPULAR COM DADOS DE TESTE:
   node seeds/seedDatabase.js

📋 ALTERAÇÕES PRINCIPAIS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✨ MySQL → PostgreSQL
   ❌ mysql2 → ✅ pg + sequelize

✨ Callbacks → Async/Await
   ❌ db.query(sql, (err, results) => {}) 
   → ✅ await Model.findAll()

✨ Models com Raw SQL → Sequelize ORM
   ❌ const User = { create: (user, callback) => { db.query(...) } }
   → ✅ const Cliente = sequelize.define('Cliente', {...})

✨ Controllers atualizados
   ❌ Callbacks de erro
   → ✅ Try/catch + async/await

✨ Validações
   ❌ Lógica sem validação no banco
   → ✅ Sequelize validators + regras de negócio

✨ Associações
   ❌ Joins manuais
   → ✅ belongsTo, hasMany (automático)

🎯 ESTRUTURA DE DADOS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Cliente 1 ──┬─→ Pedido 1 ──┬─→ ItemPedido 1 ──→ Produto A
           │              ├─→ ItemPedido 2 ──→ Produto B
           └─→ Pedido 2    └─→ ItemPedido 3 ──→ Produto A

RELACIONAMENTOS:
• Cliente hasMany Pedido
• Pedido belongsTo Cliente
• Pedido hasMany ItemPedido
• ItemPedido belongsTo Pedido
• ItemPedido belongsTo Produto
• Produto hasMany ItemPedido

💡 EXEMPLOS DE USO:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CRIAR PRODUTO (POST /produtos):
{
  "nome": "Carvão Vegetal 5kg",
  "descricao": "Premium para churrasco",
  "preco": 45.00,
  "peso_kg": 5.0,
  "estoque": 100
}

CRIAR CLIENTE (POST /clientes):
{
  "nome": "João Silva",
  "email": "joao@email.com",
  "senha": "senha123",
  "documento": "12345678901",
  "telefone": "11999999999",
  "tipo": "B2C"
}

CRIAR PEDIDO (POST /pedidos):
{
  "cliente_id": 1,
  "forma_pagamento": "pix",
  "itens": [
    {"produto_id": 1, "quantidade": 2},
    {"produto_id": 2, "quantidade": 1}
  ]
}

ATUALIZAR STATUS PEDIDO (PUT /pedidos/1/status):
{
  "status": "enviado"
}

BUSCAR RELATORIO DE VENDAS (GET /pedidos/relatorio/vendas?dataInicio=2024-01-01&dataFim=2024-12-31):
Retorna resumo com total de vendas, quantidade de pedidos, valor médio

⚠️ VALIDAÇÕES IMPLEMENTADAS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ Estoque não pode ser negativo ao atualizar produto
✓ Email único para clientes
✓ Documento (CPF/CNPJ) único para clientes
✓ Senhas criptografadas com bcrypt
✓ Quantidade mínima de 1 item no pedido
✓ Estoque verificado ao criar pedido
✓ Valor total calculado automaticamente
✓ Estoque reduzido ao criar pedido, recuperado ao deletar

📚 DOCUMENTAÇÃO:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Veja MANUAL_SEQUELIZE.md para documentação completa com:
• Estrutura de pastas
• Configuração detalhada
• Todos os endpoints
• Exemplos de requisições
• Schema de dados

🆘 TROUBLESHOOTING:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

❌ "connect ECONNREFUSED":
   → PostgreSQL não está rodando
   → Verifique variáveis no .env

❌ "database carvao_dois_irmaos does not exist":
   → Execute: CREATE DATABASE carvao_dois_irmaos;

❌ "SequelizeUniqueConstraintError":
   → Email ou documento já cadastrado

❌ "Estoque insuficiente":
   → Verifique quantidade em estoque antes de criar pedido

✅ PRONTO! Seu sistema está configurado!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);

// Script para verificar se PostgreSQL está conectado
async function checkDatabase() {
    try {
        const sequelize = require('./config/db');
        await sequelize.authenticate();
        console.log('✅ Conexão com PostgreSQL: OK');
    } catch (err) {
        console.error('❌ Erro na conexão:', err.message);
    }
}

if (require.main === module) {
    checkDatabase().then(() => process.exit(0));
}
