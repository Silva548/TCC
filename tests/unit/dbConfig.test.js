const { test } = require('node:test');
const assert = require('node:assert/strict');
// A leitura de DATABASE_URL mora em config/db.js, que tem efeito colateral
// (abre pools ao ser carregado). Para exercitá-la sem tocar no banco real, o
// teste carrega o arquivo com os pools neutralizados via require.cache.

const caminho = require.resolve('../../config/db');

const carregar = (env) => {
    const anteriores = { ...process.env };
    const caches = { ...require.cache };

    Object.assign(process.env, env);

    // Stub mínimo de pg.Pool: o db.js faz `new Pool(...)` no import
    require.cache[require.resolve('pg')] = {
        id: require.resolve('pg'),
        filename: require.resolve('pg'),
        loaded: true,
        exports: {
            Pool: class PoolStub {
                constructor(config) { this.config = config; }
                query() { return Promise.resolve({ rows: [] }); }
                end() { return Promise.resolve(); }
            },
        },
    };

    delete require.cache[caminho];
    delete require.cache[require.resolve('sequelize')];

    let modulo;
    try {
        modulo = require(caminho);
    } finally {
        require.cache[require.resolve('pg')] = caches[require.resolve('pg')];
        for (const chave of Object.keys(require.cache)) {
            if (!(chave in caches)) delete require.cache[chave];
        }
        for (const chave of Object.keys(process.env)) {
            if (!(chave in anteriores)) delete process.env[chave];
        }
        Object.assign(process.env, anteriores);
    }

    return { modulo, pool: modulo.sessionPool };
};

test('sem DATABASE_URL usa as variáveis DB_*', () => {
    const { modulo, pool } = carregar({
        DATABASE_URL: '',
        DB_HOST: 'db.exemplo',
        DB_PORT: '6543',
        DB_USER: 'carvao',
        DB_PASSWORD: 'segredo',
        DB_NAME: 'loja',
        DB_SSL: 'false',
    });

    assert.equal(modulo.config.host, 'db.exemplo');
    assert.equal(modulo.config.port, 6543);
    assert.equal(modulo.config.database, 'loja');
    assert.equal(modulo.config.username, 'carvao');
    assert.deepEqual(pool.config.ssl, undefined);
});

test('DATABASE_URL tem precedência sobre DB_*', () => {
    const { modulo, pool } = carregar({
        DATABASE_URL: 'postgres://u:p@host.railway.app:5432/loja',
        DB_HOST: 'localhost',
        DB_USER: 'ignorado',
        DB_PASSWORD: 'ignorado',
        DB_NAME: 'ignorado',
    });

    assert.equal(modulo.config.host, 'host.railway.app');
    assert.equal(modulo.config.port, 5432);
    assert.equal(modulo.config.database, 'loja');
    assert.equal(modulo.config.username, 'u');
    assert.equal(pool.config.password, 'p');
});

test('credenciais percent-encoded são decodificadas', () => {
    const { modulo } = carregar({
        DATABASE_URL: 'postgres://usuar%40io:s%40nh%40%2Fsecreta@localhost:5432/loja',
    });

    assert.equal(modulo.config.username, 'usuar@io');
    // %40 -> @, %2F -> /
    assert.equal(modulo.config.password, 's@nh@/secreta');
});

test('sslmode=require liga o TLS', () => {
    const { modulo, pool } = carregar({
        DATABASE_URL: 'postgres://u:p@host:5432/loja?sslmode=require',
    });

    assert.deepEqual(modulo.options.dialectOptions.ssl, { rejectUnauthorized: false });
    assert.deepEqual(pool.config.ssl, { rejectUnauthorized: false });
});

test('sslmode=disable não liga o TLS', () => {
    const { modulo, pool } = carregar({
        DATABASE_URL: 'postgres://u:p@host:5432/loja?sslmode=disable',
    });

    assert.equal(modulo.options.dialectOptions.ssl, undefined);
    assert.equal(pool.config.ssl, undefined);
});

test('DB_SSL=true liga o TLS sem DATABASE_URL', () => {
    const { modulo, pool } = carregar({
        DATABASE_URL: '',
        DB_SSL: 'true',
        DB_NAME: 'loja',
    });

    assert.deepEqual(modulo.options.dialectOptions.ssl, { rejectUnauthorized: false });
    assert.deepEqual(pool.config.ssl, { rejectUnauthorized: false });
});

