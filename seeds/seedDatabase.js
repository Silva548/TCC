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
        nome: 'Bolsa Carvão 5kg Premium',
        descricao: 'Bolsa de carvão premium de 5kg. Retirada na empresa ou entrega no endereço desejado.',
        preco_entrega: 21.00,
        preco_retirada: 18.00,
        embalagem: 'premium',
        peso_kg: 5.0,
        estoque: 100,
    },
    {
        nome: 'Bolsa Carvão 3kg Premium',
        descricao: 'Bolsa de carvão premium de 3kg. Retirada na empresa ou entrega no endereço desejado.',
        preco_entrega: 13.00,
        preco_retirada: 11.00,
        embalagem: 'premium',
        peso_kg: 3.0,
        estoque: 100,
    },
    {
        nome: 'Bolsa Carvão 5kg Básica',
        descricao: 'Bolsa de carvão de linha básica, 5kg. Retirada na empresa ou entrega no endereço desejado.',
        preco_entrega: 16.00,
        preco_retirada: 15.00,
        embalagem: 'basica',
        peso_kg: 5.0,
        estoque: 100,
    },
];

const seedDatabase = async () => {
    // Em produção a senha do admin nunca é fixa: usa ADMIN_SENHA se o operador
    // tiver definido, e gerada aleatória caso contrário (exibida UMA vez).
    const senhaDeAmbiente = process.env.ADMIN_SENHA;
    const senhaAdmin = senhaDeAmbiente || (process.env.NODE_ENV === 'production'
        ? crypto.randomBytes(12).toString('hex')
        : 'admin123');

    if (senhaDeAmbiente && process.env.NODE_ENV === 'production' && senhaDeAmbiente === 'admin123') {
        console.warn('⚠️  ADMIN_SENHA está com a senha padrão conhecida; troque antes de publicar.');
    }

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
                tipo_entrega: 'entrega',
                valor_total: 68.00,
                forma_pagamento: 'pix',
            });

            await ItemPedido.create({
                pedido_id: pedido1.id,
                produto_id: produtos[0].id,
                quantidade: 2,
                preco_unitario: 21.00,
            });

            await ItemPedido.create({
                pedido_id: pedido1.id,
                produto_id: produtos[1].id,
                quantidade: 2,
                preco_unitario: 13.00,
            });

            // Reduzir estoque
            await produtos[0].update({ estoque: produtos[0].estoque - 2 });
            await produtos[1].update({ estoque: produtos[1].estoque - 2 });

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
