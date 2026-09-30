const { Sequelize } = require('sequelize');
const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

// Hospedagens gerenciadas (Render, Railway, RDS) entregam a conexão como uma
// URL única em DATABASE_URL, e o config/sequelize-cli-config.js já a consome
// no ambiente production. Sem esta leitura, `npm run migrate` funcionaria e a
// aplicação subiria sem credencial nenhuma — porque ela só enxergava DB_*.
const deUrl = (bruta) => {
    const url = new URL(bruta);
    const ssl = url.searchParams.get('sslmode');

    return {
        host: url.hostname,
        port: Number(url.port) || 5432,
        user: decodeURIComponent(url.username),
        password: decodeURIComponent(url.password),
        database: decodeURIComponent(url.pathname.replace(/^\//, '')),
        // sslmode=require/verify-full indica TLS obrigatório. rejectUnauthorized
        // fica false porque a cadeia de CAvariaria por provedor e o Postgres
        // gerenciado já é alcançado por rede privada.
        ssl: ssl && ssl !== 'disable' ? { rejectUnauthorized: false } : undefined,
    };
};

const deVariaveis = () => ({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});

const origem = process.env.DATABASE_URL ? deUrl(process.env.DATABASE_URL) : deVariaveis();

const COMUM = {
    host: origem.host,
    port: origem.port,
    user: origem.user,
    password: origem.password,
    database: origem.database,
};

const sequelize = new Sequelize(COMUM.database, COMUM.user, COMUM.password, {
    host: COMUM.host,
    dialect: 'postgres',
    port: COMUM.port,
    logging: false, // Mude para console.log para debug
    pool: {
        max: Number(process.env.DB_POOL_MAX) || 10,
        min: 0,
        idleTimeoutMillis: Number(process.env.DB_POOL_IDLE_MS) || 30000,
    },
    // Habilite quando o Postgres estiver atrás de provedor com TLS (Render, Railway, RDS)
    dialectOptions: origem.ssl ? { ssl: origem.ssl } : {},
});

// Pool separado, exclusivo do connect-pg-simple.
//
// Não dá para reaproveitar o pool do Sequelize: em v6 ele é uma abstração
// própria (sequelize-pool) que abre/fecha um cliente `pg` por aquisição, e
// não expõe um `pg.Pool` — o connect-pg-simple exige um objeto com `.query()`
// estilo `pg.Pool`.
//
// Orçamento total de conexões = DB_POOL_MAX (Sequelize) + DB_SESSION_POOL_MAX
// (sessões). Mantenha a soma abaixo de max_connections do servidor, incluindo
// as conexões reservadas a superusuário.
const sessionPool = new Pool({
    ...COMUM,
    max: Number(process.env.DB_SESSION_POOL_MAX) || 3,
    idleTimeoutMillis: Number(process.env.DB_POOL_IDLE_MS) || 30000,
    ssl: origem.ssl,
});

module.exports = sequelize;
module.exports.sequelize = sequelize;
module.exports.sessionPool = sessionPool;
