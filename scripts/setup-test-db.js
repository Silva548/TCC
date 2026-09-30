// Prepara o banco de testes: cria (se necessário), aplica as migrations e
// limpa as tabelas. Executado automaticamente por `npm test` (via `pretest`).
//
// Não derruba o `npm test` quando o Postgres não está disponível: nesse caso
// avisa e os testes de integração se auto-omitem, de modo que os unitários
// continuem rodando.
require('dotenv').config();

const path = require('path');
const { execFileSync } = require('child_process');
const { Client } = require('pg');

const RAIZ = path.resolve(__dirname, '..');
const BINARIO_SEQUELIZE = path.join(RAIZ, 'node_modules', '.bin', 'sequelize');

const ADMIN_DB = process.env.DB_ADMIN_NAME || 'postgres';
const TEST_DB = process.env.DB_NAME_TEST;

// Tabelas gerenciadas por migrations, na ordem inversa das dependências.
// "session" é criada pelo connect-pg-simple e também precisa ser limpa.
const TABELAS = [
    'itens_pedidos',
    'pedidos',
    'produtos',
    'categorias',
    'clientes',
    'users',
    'session',
];

// Tabela do connect-pg-simple. Ela é criada sob demanda pela lib em runtime,
// mas o script precisa dela para limpar o estado entre execuções e para que os
// testes contem com ela existindo.
const SQL_SESSION = `
    CREATE TABLE IF NOT EXISTS "session" (
        sid    varchar   NOT NULL COLLATE "default",
        sess   json      NOT NULL,
        expire timestamp(6) NOT NULL,
        CONSTRAINT session_pkey PRIMARY KEY (sid)
    )
`;

// Um identificador de banco não pode ser parâmetro vinculado ($1) em DDL, e
// interpolar o valor sem filtro permitiria injeção de SQL via .env
const identificadorSeguro = (nome) => /^[a-z_][a-z0-9_]*$/i.test(nome);

const conectar = async (config) => {
    const client = new Client(config);
    await client.connect();
    return client;
};

const criarBancoSeAusente = async (client) => {
    if (!identificadorSeguro(TEST_DB)) {
        throw new Error(`DB_NAME_TEST inválido: "${TEST_DB}". Use apenas letras, dígitos e "_".`);
    }

    const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [TEST_DB]);
    if (rowCount > 0) {
        console.log(`[setup-test-db] Banco "${TEST_DB}" já existe.`);
        return false;
    }

    await client.query(`CREATE DATABASE "${TEST_DB}"`);
    console.log(`[setup-test-db] Banco "${TEST_DB}" criado.`);
    return true;
};

// Reaproveita o CLI e o config/sequelize-cli-config.js em vez de reimplementar
// a aplicação de migrations — evita duplicar a lógica de resolução de arquivos.
const aplicarMigrations = () => {
    execFileSync(process.execPath, [BINARIO_SEQUELIZE, 'db:migrate'], {
        cwd: RAIZ,
        stdio: 'inherit',
        env: { ...process.env, NODE_ENV: 'test', DB_NAME: TEST_DB, DB_NAME_TEST: TEST_DB },
    });
};

// Só limpa o que existe: um TRUNCATE em tabela ausente aborta a transação
// inteira e a suíte falha com um erro que não tem relação com o código testado.
const limparTabelas = async (client) => {
    await client.query(SQL_SESSION);

    const { rows } = await client.query(
        'SELECT tablename FROM pg_tables WHERE schemaname = $1',
        ['public']
    );
    const existentes = new Set(rows.map((r) => r.tablename));

    const alvo = TABELAS.filter((t) => existentes.has(t));
    const ignoradas = TABELAS.filter((t) => !existentes.has(t));
    if (ignoradas.length) {
        console.warn(`[setup-test-db] Tabelas ausentes, ignoradas: ${ignoradas.join(', ')}`);
    }
    if (!alvo.length) return;

    await client.query(`TRUNCATE TABLE ${alvo.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`);
};

const main = async () => {
    if (!TEST_DB) {
        console.warn('[setup-test-db] DB_NAME_TEST não definido no .env — testes de integração serão omitidos.');
        console.warn('[setup-test-db] Adicione DB_NAME_TEST="<seu_banco>_test" para habilitá-los.');
        return;
    }

    if (TEST_DB === process.env.DB_NAME) {
        throw new Error('DB_NAME_TEST é igual a DB_NAME. Usar o mesmo banco apagaria seus dados de desenvolvimento.');
    }

    let admin;
    try {
        admin = await conectar({
            host: process.env.DB_HOST || 'localhost',
            port: Number(process.env.DB_PORT) || 5432,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: ADMIN_DB,
        });
    } catch (err) {
        console.warn(`[setup-test-db] Postgres indisponível (${err.message}) — testes de integração serão omitidos.`);
        return;
    }

    try {
        await criarBancoSeAusente(admin);
    } finally {
        await admin.end();
    }

    // Migrations rodam em conexão própria (o Sequelize gerenciaria o pool)
    let worker;
    try {
        worker = await conectar({
            host: process.env.DB_HOST || 'localhost',
            port: Number(process.env.DB_PORT) || 5432,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: TEST_DB,
        });
    } catch (err) {
        throw new Error(`não foi possível conectar em "${TEST_DB}": ${err.message}`, { cause: err });
    }

    try {
        aplicarMigrations();
        await limparTabelas(worker);
        console.log('[setup-test-db] Migrations aplicadas e tabelas limpas.');
    } finally {
        await worker.end();
    }
};

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error('[setup-test-db] Falha:', err.message);
        process.exit(1);
    });
