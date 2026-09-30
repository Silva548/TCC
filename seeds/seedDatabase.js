// seeds/seedDatabase.js - Seed com dados de teste
//
// Idempotente: pode rodar várias vezes sem estourar unique constraint nem
// duplicar pedido de demonstração. A versão anterior quebrava com um stack do
// Sequelize na segunda execução (clientes/produtos em bulkCreate sem
// ignoreDuplicates) e ainda saía com código 0, parecendo ter funcionado.

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { Cliente, Produto, Pedido, ItemPedido, User, Categoria } = require('../models/index');

const CLIENTES = [
    {
        nome: 'João Silva',
        email: 'joao@email.com',
        documento: '12345678901',
        telefone: '11999999999',
        tipo: 'B2C',
    },
    {
        nome: 'Empresa XYZ Ltda',
        email: 'contato@xyz.com',
        documento: '12345678901234',
        telefone: '1133333333',
        tipo: 'B2B',
    },
    {
        nome: 'Maria Santos',
        email: 'maria@email.com',
        documento: '98765432101',
        telefone: '11988888888',
        tipo: 'B2C',
    },
];

const PRODUTOS = [
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
];

const seedDatabase = async () => {
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

        // bulkCreate com ignoreDuplicates não devolve as linhas existentes,
        // então busca-se o conjunto completo para associar aos produtos
        const categorias = await Categoria.findAll({ order: [['nome', 'ASC']] });
        const porNome = (nome) => categorias.find((c) => c.nome === nome);

        console.log('✓ Categorias criadas');

        // Clientes: email e documento são UNIQUE, então ignoreDuplicates
        // descarta os que já existem em vez de estourar a constraint.
        await Cliente.bulkCreate(CLIENTES, { ignoreDuplicates: true });
        const clientes = await Cliente.findAll({
            where: { email: CLIENTES.map((c) => c.email) },
            order: [['nome', 'ASC']],
        });

        console.log('✓ Clientes criados');

        // Produtos: nome NÃO é unique no schema, então ignoreDuplicates não
        // ajudaria — duas linhas com o mesmo nome entrariam. findOrCreate por
        // nome é o que mantém a segunda execução honesta.
        const produtos = [];
        for (const produto of PRODUTOS) {
            const [linha] = await Produto.findOrCreate({
                where: { nome: produto.nome },
                defaults: { ...produto, categoria_id: porNome('Carvão Vegetal').id },
            });
            produtos.push(linha);
        }

        console.log('✓ Produtos criados');

        // Pedido de demonstração: só na primeira execução. Recriá-lo a cada
        // seed baixaria o estoque de novo e inflaria o relatório de vendas.
        if (await Pedido.count()) {
            console.log('✓ Pedidos já existem — mantido o histórico');
        } else {
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
        }

        console.log('\n✅ Banco de dados populado com dados de teste!');
        console.log('\n📋 Dados de teste:');
        console.log('\nClientes:');
        clientes.forEach(c => console.log(`  - ${c.nome} (${c.email})`));
        console.log('\nProdutos:');
        produtos.forEach(p => console.log(`  - ${p.nome} (${p.estoque} em estoque)`));
};

// Executar seed
if (require.main === module) {
    const { sequelize } = require('../models/index');

    sequelize.authenticate().then(() => {
        console.log('⚠️  Aplique as migrations antes (npm run migrate) se o banco estiver vazio.');
        return seedDatabase();
    }).then(async () => {
        await sequelize.close();
        process.exit(0);
    }).catch(async (err) => {
        console.error('❌ Erro ao popular banco de dados:', err.message);
        if (err.name === 'SequelizeConnectionError') {
            console.error('   Verifique se o Postgres está no ar e se o .env está correto.');
        }
        await sequelize.close().catch(() => {});
        process.exit(1);
    });
}

module.exports = seedDatabase;
