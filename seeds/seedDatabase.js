// seeds/seedDatabase.js - Seed com dados de teste

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { Cliente, Produto, Pedido, ItemPedido, User, Categoria } = require('../models/index');

const seedDatabase = async () => {
    try {
        // Em produção a senha do admin é gerada aleatoriamente e exibida UMA vez;
        // nunca usar credencial fixa conhecida
        const senhaAdmin = process.env.NODE_ENV === 'production'
            ? crypto.randomBytes(12).toString('hex')
            : 'admin123';

        // Criar usuário admin padrão
        const [, adminCriado] = await User.findOrCreate({
            where: { username: 'admin' },
            defaults: {
                username: 'admin',
                password: await bcrypt.hash(senhaAdmin, 10),
                role: 'admin',
            },
        });

        if (adminCriado) {
            console.log(`✓ Usuário admin criado (login: admin / senha: ${senhaAdmin})`);
            if (process.env.NODE_ENV === 'production') {
                console.log('⚠️  Guarde esta senha agora — ela não será exibida novamente.');
            }
        } else {
            console.log('✓ Usuário admin já existe');
        }

        // Criar categorias de teste
        await Categoria.bulkCreate([
            { nome: 'Carvão Vegetal' },
            { nome: 'Lenha' },
            { nome: 'Acessórios' },
        ], { ignoreDuplicates: true });

        console.log('✓ Categorias criadas');

        // Criar clientes de teste
        const clientes = await Cliente.bulkCreate([
            {
                nome: 'João Silva',
                email: 'joao@email.com',
                senha: await bcrypt.hash('senha123', 10),
                documento: '12345678901',
                telefone: '11999999999',
                tipo: 'B2C',
            },
            {
                nome: 'Empresa XYZ Ltda',
                email: 'contato@xyz.com',
                senha: await bcrypt.hash('senha456', 10),
                documento: '12345678901234',
                telefone: '1133333333',
                tipo: 'B2B',
            },
            {
                nome: 'Maria Santos',
                email: 'maria@email.com',
                senha: await bcrypt.hash('senha789', 10),
                documento: '98765432101',
                telefone: '11988888888',
                tipo: 'B2C',
            },
        ]);

        console.log('✓ Clientes criados');

        // Criar produtos de teste (Carvão Vegetal)
        const produtos = await Produto.bulkCreate([
            {
                nome: 'Carvão Vegetal 5kg',
                descricao: 'Carvão vegetal premium para churrasco. Excelente qualidade.',
                preco: 45.00,
                peso_kg: 5.0,
                estoque: 100,
            },
            {
                nome: 'Carvão Vegetal 10kg',
                descricao: 'Carvão vegetal premium em saco de 10kg. Ideal para churrasqueiras.',
                preco: 85.00,
                peso_kg: 10.0,
                estoque: 75,
            },
            {
                nome: 'Carvão Vegetal 20kg',
                descricao: 'Embalagem grande de carvão vegetal. Melhor custo-benefício.',
                preco: 160.00,
                peso_kg: 20.0,
                estoque: 50,
            },
            {
                nome: 'Carvão Vegetal Premium 2kg',
                descricao: 'Carvão vegetal premium em pacote pequeno.',
                preco: 22.00,
                peso_kg: 2.0,
                estoque: 200,
            },
        ]);

        console.log('✓ Produtos criados');

        // Criar pedidos de teste
        const pedido1 = await Pedido.create({
            cliente_id: clientes[0].id,
            data: new Date(),
            status: 'pendente',
            valor_total: 130.00,
            forma_pagamento: 'pix',
        });

        await ItemPedido.create({
            pedido_id: pedido1.id,
            produto_id: produtos[0].id,
            quantidade: 2,
            preco_unitario: 45.00,
        });

        await ItemPedido.create({
            pedido_id: pedido1.id,
            produto_id: produtos[3].id,
            quantidade: 2,
            preco_unitario: 22.00,
        });

        // Reduzir estoque
        await produtos[0].update({ estoque: produtos[0].estoque - 2 });
        await produtos[3].update({ estoque: produtos[3].estoque - 2 });

        console.log('✓ Pedidos criados');

        console.log('\n✅ Banco de dados populado com dados de teste!');
        console.log('\n📋 Dados de teste:');
        console.log('\nClientes:');
        clientes.forEach(c => console.log(`  - ${c.nome} (${c.email})`));
        console.log('\nProdutos:');
        produtos.forEach(p => console.log(`  - ${p.nome} (${p.estoque} em estoque)`));

    } catch (err) {
        console.error('❌ Erro ao popular banco de dados:', err);
    }
};

// Executar seed
if (require.main === module) {
    const { sequelize } = require('../models/index');

    sequelize.authenticate().then(() => {
        console.log('⚠️  Aplique as migrations antes (npm run migrate) se o banco estiver vazio.');
        return seedDatabase();
    }).then(() => {
        process.exit(0);
    }).catch((err) => {
        console.error('Falha na conexão com o banco:', err.message);
        process.exit(1);
    });
}

module.exports = seedDatabase;
