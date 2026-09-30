// Testes de integração: sobem o app real (config/db.js, sessão, CSRF, rotas)
// em uma porta efêmera e falam HTTP com fetch.
//
// Sem dependência nova (nada de supertest): o app já exporta a instância
// express, então basta listen(0) e usar a porta que o sistema escolher.
//
// Estes testes exigem o banco de testes, preparado por scripts/setup-test-db.js
// (roda sozinho no `pretest`). Sem DB_NAME_TEST ou sem servidor no ar, a
// suíte inteira é omitida em vez de derrubar `npm test`.
require('dotenv').config();

const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { Sequelize } = require('sequelize');

const TEST_DB = process.env.DB_NAME_TEST;

// Precisa vir antes de qualquer require que carregue config/db.js, senão o app
// conecta no banco de desenvolvimento
if (TEST_DB) {
    process.env.DB_NAME = TEST_DB;
}

const semBanco = !TEST_DB;
const BASE = { host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT) || 5432, dialect: 'postgres' };

let app;
let server;
let baseUrl;
let sequelize;
let autenticado;
let User;
let Cliente;
let Categoria;
let Produto;

const USUARIO = { username: 'teste_integracao', password: 'Senha@123', role: 'admin' };

// Precisa ser definido antes de require('../app'): os limitadores leem o env
// na construção do módulo
process.env.LOGIN_RATE_LIMIT = process.env.LOGIN_RATE_LIMIT || '1000';
process.env.RATE_LIMIT_MAX = process.env.RATE_LIMIT_MAX || '10000';

// ---------------------------------------------------------------------------
// Infraestrutura
// ---------------------------------------------------------------------------

const bancoDisponivel = async () => {
    if (semBanco) return false;
    sequelize = new Sequelize(TEST_DB, process.env.DB_USER, process.env.DB_PASSWORD, {
        ...BASE, username: process.env.DB_USER, password: process.env.DB_PASSWORD, logging: false,
    });
    try {
        await sequelize.authenticate();
        return true;
    } catch {
        return false;
    }
};

// Cliente HTTP com cookie jar: mantém a sessão entre requisições, como um browser
const criarCliente = (base) => {
    const cookies = new Map();

    return async (caminho, { method = 'GET', body, headers = {}, redirect = 'manual' } = {}) => {
        const cabecalhos = { ...headers };
        if (cookies.size) {
            cabecalhos.Cookie = [...cookies].map(([k, v]) => `${k}=${v}`).join('; ');
        }

        let corpo;
        if (body !== undefined) {
            cabecalhos['Content-Type'] = 'application/x-www-form-urlencoded';
            // Aceita lista de pares além do objeto, porque é o único jeito de
            // repetir uma chave: new URLSearchParams({ 'a[]': [1, 2] }) gera
            // "a[]=1%2C2" (uma string com vírgula), enquanto o browser envia
            // "a[]=1&a[]=2". O formulário de pedidos depende dessa repetição.
            corpo = new URLSearchParams(body).toString();
        }

        const res = await fetch(`${base}${caminho}`, { method, headers: cabecalhos, body: corpo, redirect });

        for (const bruto of res.headers.getSetCookie?.() || []) {
            const [par] = bruto.split(';');
            const idx = par.indexOf('=');
            cookies.set(par.slice(0, idx).trim(), par.slice(idx + 1).trim());
        }

        return res;
    };
};

const extrairCsrf = async (cliente, caminho = '/login') => {
    const res = await cliente(caminho);
    const html = await res.text();
    const match = html.match(/name="_csrf" value="([^"]+)"/);
    assert.ok(match, `não encontrei o token CSRF em ${caminho} (status ${res.status})`);
    return match[1];
};

// O destino de pós-login viaja como campo hidden `next` do formulário — o
// middleware/auth.js o coloca na query do redirect, e o controller o repassa
// para o form. Ler os dois do HTML reflete o round-trip real do browser.
const abrirLogin = async (cliente, caminho = '/login') => {
    const res = await cliente(caminho);
    const html = await res.text();
    const csrf = html.match(/name="_csrf" value="([^"]+)"/);
    const next = html.match(/name="next" value="([^"]*)"/);
    assert.ok(csrf, `formulário de login sem token CSRF em ${caminho}`);
    return { csrf: csrf[1], proximo: next ? next[1] : '' };
};

// Reproduz o round-trip do browser numa rota protegida: /produtos responde 302
// para /login?next=%2Fprodutos. O cliente usa redirect:'manual', então o
// Location precisa ser seguido à mão — senão o formulário é renderizado sem o
// `next` e o teste passaria por vazio.
const abrirLoginAposRedirect = async (cliente, rotaProtegida = '/produtos') => {
    const redirecionado = await cliente(rotaProtegida);
    assert.equal(redirecionado.status, 302, 'rota protegida deveria redirecionar');

    const location = redirecionado.headers.get('location');
    assert.match(location, /^\/login\?next=/);

    const url = new URL(location, baseUrl);
    return abrirLogin(cliente, url.pathname + url.search);
};

const fazerLogin = async (cliente, usuario = USUARIO) => {
    const csrf = await extrairCsrf(cliente, '/login');
    const res = await cliente('/login', {
        method: 'POST',
        body: { username: usuario.username, password: usuario.password, _csrf: csrf },
    });
    assert.equal(res.status, 302, `login falhou: ${res.status} ${await res.text()}`);
    return res;
};

const semear = async () => {
    const { hashSync } = bcrypt;

    // Um TRUNCATE só, com CASCADE: destruir modelo por modelo falha em
    // "clientes" por causa da FK de "pedidos"
    await sequelize.query(
        `TRUNCATE TABLE "itens_pedidos", "pedidos", "produtos", "categorias", "clientes", "users", "session" RESTART IDENTITY CASCADE`
    );

    await User.create({ username: USUARIO.username, password: hashSync(USUARIO.password, 10), role: USUARIO.role });
    await Categoria.create({ nome: 'Carvão Vegetal' });
    await Cliente.create({ nome: 'Cliente Teste', email: 'cliente@teste.com', documento: '12345678901' });
};test.before(async () => {
    if (semBanco) {
        console.warn('[integração] DB_NAME_TEST não definido — suíte de integração omitida.');
        return;
    }
    if (!(await bancoDisponivel())) {
        console.warn(`[integração] banco "${TEST_DB}" inacessível — suíte de integração omitida.`);
        return;
    }

    // app só depois do ajuste de DB_NAME
    app = require('../app');
    ({ User, Cliente, Categoria, Produto } = require('../models'));

    await semear();

    await new Promise((resolve) => {
        server = app.listen(0, resolve);
    });
    baseUrl = `http://127.0.0.1:${server.address().port}`;

    // Sessão compartilhada: evita refazer login (e estourar o limitador) em
    // cada teste que só precisa estar autenticado
    autenticado = criarCliente(baseUrl);
    await fazerLogin(autenticado);
});

test.after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (sequelize) await sequelize.close();
});

const pular = () => (semBanco || !baseUrl);

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test('app sobe e responde no /health', async (t) => {
    if (pular()) return t.skip('banco de testes indisponível');

    const cliente = criarCliente(baseUrl);
    const res = await cliente('/health');

    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { status: 'ok', database: 'up' });
});

test('toda resposta carrega X-Request-Id e o cliente pode propagá-lo', async (t) => {
    if (pular()) return t.skip('banco de testes indisponível');

    const cliente = criarCliente(baseUrl);
    const gerado = await cliente('/health');
    assert.match(gerado.headers.get('x-request-id'), /^[0-9a-f-]{36}$/);

    const meu = 'req-abc-123';
    const res = await cliente('/health', { headers: { 'X-Request-Id': meu } });
    assert.equal(res.headers.get('x-request-id'), meu, 'o id enviado deve ser preservado');
});

test('X-Request-Id malformado é substituído por um gerado', async (t) => {
    if (pular()) return t.skip('banco de testes indisponível');

    const cliente = criarCliente(baseUrl);
    // Valor aceito pelo transporte HTTP mas rejeitado pela regex do middleware
    // (que só admite /[\w.:-]/). Uma quebra de linha não serve aqui: o próprio
    // fetch a recusa antes de sair, então o teste não exercitaria o middleware.
    const malformado = 'id invalido com espacos';
    const res = await cliente('/health', { headers: { 'X-Request-Id': malformado } });

    assert.notEqual(res.headers.get('x-request-id'), malformado);
    assert.match(res.headers.get('x-request-id'), /^[0-9a-f-]{36}$/);
});

test('API /pedidos responde 401 em JSON, não 302 de browser', async (t) => {
    if (pular()) return t.skip('banco de testes indisponível');

    const cliente = criarCliente(baseUrl);

    // Regressão de F12: com Accept: */* (padrão de curl/fetch) a API respondia
    // com redirect HTML em vez de 401
    const padrao = await cliente('/pedidos');
    assert.equal(padrao.status, 401);
    assert.match(padrao.headers.get('content-type'), /application\/json/);
    assert.deepEqual(await padrao.json(), { error: 'Não autenticado' });

    const explicito = await cliente('/pedidos', { headers: { Accept: 'application/json' } });
    assert.equal(explicito.status, 401);

    // Navegação de browser continua redirecionando para o login
    const nav = await cliente('/pedidos', { headers: { Accept: 'text/html,application/xhtml+xml' } });
    assert.equal(nav.status, 302);
    assert.match(nav.headers.get('location'), /^\/login\?next=/);
});

test('rota inexistente em rota JSON devolve 404 em JSON', async (t) => {
    if (pular()) return t.skip('banco de testes indisponível');

    // autenticado: sem sessão o requireAuth responde 401 antes da 404
    // Caminho com dois segmentos: um único segmento cai em router.param('id') e
    // responderia 400 (id inválido), que não é o que este teste exercita.
    const res = await autenticado('/pedidos/1/rota-que-nao-existe');

    assert.equal(res.status, 404);
    assert.match(res.headers.get('content-type'), /application\/json/);
});

test('rota inexistente em navegação devolve HTML', async (t) => {
    if (pular()) return t.skip('banco de testes indisponível');

    const cliente = criarCliente(baseUrl);
    const res = await cliente('/pagina-que-nao-existe', { headers: { Accept: 'text/html' } });

    assert.equal(res.status, 404);
    assert.match(res.headers.get('content-type'), /text\/html/);
});

test('login bem-sucedido cria sessão e libera a API', async (t) => {
    if (pular()) return t.skip('banco de testes indisponível');

    const cliente = criarCliente(baseUrl);
    const login = await fazerLogin(cliente);

    assert.equal(login.headers.get('location'), '/');
    assert.match(login.headers.get('set-cookie') || '', /sessionId=/);

    const pedidos = await cliente('/pedidos');
    assert.equal(pedidos.status, 200);

    const corpo = await pedidos.json();
    assert.ok(Array.isArray(corpo.pedidos));
    assert.equal(corpo.pedidos.length, 0, 'banco limpo, então não há pedidos');
    assert.equal(corpo.paginacao.total, 0);
});

test('cookie de sessão é httpOnly e SameSite', async (t) => {
    if (pular()) return t.skip('banco de testes indisponível');

    const cliente = criarCliente(baseUrl);
    const csrf = await extrairCsrf(cliente, '/login');
    const res = await cliente('/login', {
        method: 'POST',
        body: { username: USUARIO.username, password: USUARIO.password, _csrf: csrf },
    });

    const cookie = (res.headers.getSetCookie?.() || []).join(';');
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /SameSite=Lax/i);
});

test('login sem token CSRF é recusado com 403', async (t) => {
    if (pular()) return t.skip('banco de testes indisponível');

    const cliente = criarCliente(baseUrl);
    await extrairCsrf(cliente, '/login');
    const res = await cliente('/login', {
        method: 'POST',
        body: { username: USUARIO.username, password: USUARIO.password },
    });

    assert.equal(res.status, 403);
});

test('senha errada não autentica', async (t) => {
    if (pular()) return t.skip('banco de testes indisponível');

    const cliente = criarCliente(baseUrl);
    const csrf = await extrairCsrf(cliente, '/login');
    const res = await cliente('/login', {
        method: 'POST',
        body: { username: USUARIO.username, password: 'senha-errada', _csrf: csrf },
    });

    assert.equal(res.status, 302);
    assert.equal(res.headers.get('location'), '/login', 'falha devolve ao formulário, não avança');

    const pedidos = await cliente('/pedidos');
    assert.equal(pedidos.status, 401, 'sessão anônima após falha');
});

test('credenciais inválidas na API devolvem 401 sem revelar se o usuário existe', async (t) => {
    if (pular()) return t.skip('banco de testes indisponível');

    const cliente = criarCliente(baseUrl);
    const csrf = await extrairCsrf(cliente, '/login');

    const inexistente = await cliente('/login', {
        method: 'POST',
        body: { username: 'nao_existe_ninguem', password: 'x', _csrf: csrf },
    });
    const existente = await cliente('/login', {
        method: 'POST',
        body: { username: USUARIO.username, password: 'x', _csrf: csrf },
    });

    assert.equal(inexistente.status, existente.status, 'respostas devem ser indistinguíveis');
});

test('returnTo malicioso não vira redirect para fora do site', async (t) => {
    if (pular()) return t.skip('banco de testes indisponível');

    const cliente = criarCliente(baseUrl);

    // O vetor real é o campo `next` do POST /login: ele vem do corpo da
    // requisição, totalmente controlado pelo atacante, e vira o Location do
    // redirect de sucesso. (requireAuth põe o next na query, mas só sob
    // /produtos|/categorias|... , onde o originalUrl nunca começa com "//".)
    const { csrf } = await abrirLogin(cliente);

    const res = await cliente('/login', {
        method: 'POST',
        body: {
            username: USUARIO.username,
            password: USUARIO.password,
            _csrf: csrf,
            next: '//evil.com/x',
        },
    });

assert.equal(res.status, 302);
    const destino = res.headers.get('location');
    assert.equal(destino, '/', `um next protocol-relative deve cair em "/", veio "${destino}"`);
    assert.ok(!destino.startsWith('//'), `destino não pode ser protocol-relative: "${destino}"`);
});

test('returnTo legítimo é preservado após o login', async (t) => {
    if (pular()) return t.skip('banco de testes indisponível');

    const cliente = criarCliente(baseUrl);
    const { csrf, proximo } = await abrirLoginAposRedirect(cliente);
    assert.equal(proximo, '/produtos', 'o destino legítimo deve chegar ao formulário');

    const res = await cliente('/login', {
        method: 'POST',
        body: { username: USUARIO.username, password: USUARIO.password, _csrf: csrf, next: proximo },
    });

    assert.equal(res.headers.get('location'), '/produtos');
});

test('query inválida devolve 400 em vez de 500', async (t) => {
    if (pular()) return t.skip('banco de testes indisponível');

    const cliente = criarCliente(baseUrl);
    await fazerLogin(cliente);

    const statusRuim = await cliente('/pedidos?status=nao-existe');
    assert.equal(statusRuim.status, 400);
    assert.deepEqual(await statusRuim.json(), {
        error: 'Status inválido. Use: pendente, processando, enviado, entregue, cancelado',
    });

    // Não numérico viraria erro de tipo do Postgres (HTTP 500)
    const clienteRuim = await cliente('/pedidos?cliente_id=abc');
    assert.equal(clienteRuim.status, 400);

    const paginaRuim = await cliente('/pedidos?page=zero');
    assert.equal(paginaRuim.status, 200, 'page inválida cai no padrão 1, não é erro');
});

test('valores válidos de filtro são aceitos', async (t) => {
    if (pular()) return t.skip('banco de testes indisponível');

    const cliente = criarCliente(baseUrl);
    await fazerLogin(cliente);

    const clienteId = await Cliente.findOne({ attributes: ['id'] });

    for (const caminho of ['/pedidos?status=pendente', `/pedidos?cliente_id=${clienteId.id}`, '/pedidos?page=1&limit=10']) {
        const res = await cliente(caminho);
        assert.equal(res.status, 200, `${caminho} deveria ser aceito`);
    }
});

test('página absurda é limitada em vez de varrer a tabela', async (t) => {
    if (pular()) return t.skip('banco de testes indisponível');

    const cliente = criarCliente(baseUrl);
    await fazerLogin(cliente);

    const res = await cliente('/pedidos?page=999999999');
    assert.equal(res.status, 200);

    const corpo = await res.json();
    assert.equal(corpo.paginacao.pagina, 10000, 'teto de páginas aplicado');
});

test('produtos carregam a categoria associada', async (t) => {
    if (pular()) return t.skip('banco de testes indisponível');

    const categoria = await Categoria.findOne();
    await Produto.create({ nome: 'Carvão 5kg', preco: 25.5, peso_kg: 5, estoque: 10, categoria_id: categoria.id });

    const cliente = criarCliente(baseUrl);
    await fazerLogin(cliente);

    const res = await cliente('/produtos');
    assert.equal(res.status, 200);

    const html = await res.text();
    assert.match(html, /Carvão 5kg/);
    assert.match(html, /Carvão Vegetal/, 'nome da categoria deve aparecer na listagem');
});

test('filtro de produtos por categoria rejeita valor não numérico', async (t) => {
    if (pular()) return t.skip('banco de testes indisponível');

    const cliente = criarCliente(baseUrl);
    await fazerLogin(cliente);

    const res = await cliente('/produtos?categoria_id=abc');
    assert.equal(res.status, 400);
});

test('ID de recurso não numérico devolve 400, não 500', async (t) => {
    if (pular()) return t.skip('banco de testes indisponível');

    const cliente = criarCliente(baseUrl);
    await fazerLogin(cliente);

    // /produtos é rota web: sem Accept explícito a resposta de erro é HTML.
    // O 400 em JSON é o comportamento quando o chamador se declara como API.
    const html = await cliente('/produtos/abc');
    assert.equal(html.status, 400);
    assert.match(html.headers.get('content-type'), /text\/html/);

    const res = await cliente('/produtos/abc', { headers: { Accept: 'application/json' } });
    assert.equal(res.status, 400);
    assert.match(res.headers.get('content-type'), /application\/json/);
    assert.deepEqual(await res.json(), { error: 'ID inválido' });
});

test('rota sem sessão não cria registro na tabela de sessões', async (t) => {
    if (pular()) return t.skip('banco de testes indisponível');

    const [antes] = await sequelize.query('SELECT count(*)::int AS n FROM "session"');
    const cliente = criarCliente(baseUrl);
    await cliente('/produtos');           // protegido, sem cookie
    await cliente('/health');
    const [depois] = await sequelize.query('SELECT count(*)::int AS n FROM "session"');

    assert.equal(depois[0].n, antes[0].n, 'visita anônima não deve persistir sessão');
});

test('a coluna senha não existe mais em clientes', async (t) => {
    if (pular()) return t.skip('banco de testes indisponível');

    const [colunas] = await sequelize.query(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'clientes'"
    );
    const nomes = colunas.map((c) => c.column_name);

    assert.ok(!nomes.includes('senha'), 'a coluna senha deveria ter sido removida');
    assert.ok(nomes.includes('nome'));
    // "cpf" foi renomeado para "documento" (aceita CPF e CNPJ) na migração
    assert.ok(nomes.includes('documento'));
});

test('clientes/:id não expõe campo de senha na resposta', async (t) => {
    if (pular()) return t.skip('banco de testes indisponível');

    const cliente = criarCliente(baseUrl);
    await fazerLogin(cliente);

    const res = await cliente('/clientes');
    assert.equal(res.status, 200);

    const html = await res.text();
    assert.doesNotMatch(html, /name="senha"/i, 'formulário de cliente não deve ter campo de senha');
});

test('a coluna categoria_id existe em produtos', async (t) => {
    if (pular()) return t.skip('banco de testes indisponível');

    const [colunas] = await sequelize.query(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'produtos'"
    );
    assert.ok(colunas.some((c) => c.column_name === 'categoria_id'));
});

// ---------------------------------------------------------------------------
// Regressões de integridade de dados e de sessão
// ---------------------------------------------------------------------------

test('formulários de cliente abrem em 200', async (t) => {
    if (pular()) return t.skip('banco de testes indisponível');

    const cliente = criarCliente(baseUrl);
    await fazerLogin(cliente);

    // Regressão: os controllers de cliente não passavam `body` para a view, e
    // as views leem `body && body.campo`. Sem essa local o EJS resolve o
    // identificador no escopo global e lança ReferenceError -> 500.
    const criar = await cliente('/clientes/new');
    assert.equal(criar.status, 200, `GET /clientes/new devolveu ${criar.status}`);

    const listado = await cliente('/clientes');
    assert.equal(listado.status, 200);
    const id = /\/clientes\/(\d+)\/edit/.exec(await listado.text())?.[1];
    assert.ok(id, 'não encontrei um cliente para editar');

    const editar = await cliente(`/clientes/${id}/edit`);
    assert.equal(editar.status, 200, `GET /clientes/${id}/edit devolveu ${editar.status}`);
});

test('CHECK de estoque impede valor negativo no banco', async (t) => {
    if (pular()) return t.skip('banco de testes indisponível');

    const produto = await Produto.create({
        nome: 'Produto Para Check', preco: 10, peso_kg: 1, estoque: 0,
    });

    // finally: se a rejeição não vier, a linha fica com estoque negativo e
    // quebra a aplicação das migrations seguintes (o CHECK não pode ser
    // adicionado enquanto existirem linhas que o violem).
    try {
        await assert.rejects(
            () => Produto.update({ estoque: -1 }, { where: { id: produto.id } }),
            /estoque/i,
            'o CHECK do banco deveria recusar estoque negativo'
        );

        await produto.reload();
        assert.equal(produto.estoque, 0, 'o valor recusado não pode ter sido gravado');
    } finally {
        await Produto.update({ estoque: 0 }, { where: { id: produto.id } });
        await produto.destroy();
    }
});

test('mesmo produto em duas linhas soma as quantidades contra o estoque', async (t) => {
    if (pular()) return t.skip('banco de testes indisponível');

    const cliente = criarCliente(baseUrl);
    await fazerLogin(cliente);
    const csrf = await extrairCsrf(cliente, '/produtos');

    const produto = await Produto.create({
        nome: 'Carvão Teste Agregação', preco: 10, peso_kg: 5, estoque: 8,
    });
    const { Cliente } = require('../models');
    const alvo = await Cliente.create({ nome: 'Cli Agreg', email: `agreg${Date.now()}@t.com`, documento: String(Date.now()).slice(-11) });

    // Regressão do estoque negativo: 5 + 5 do mesmo produto contra estoque 8.
    // Validação linha a linha lia o estoque inteiro duas vezes e deixaria -2.
    const res = await cliente('/pedidos', {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: {
            _csrf: csrf,
            cliente_id: alvo.id,
            forma_pagamento: 'pix',
            'itens[0][produto_id]': produto.id,
            'itens[0][quantidade]': 5,
            'itens[1][produto_id]': produto.id,
            'itens[1][quantidade]': 5,
        },
    });

    assert.equal(res.status, 400, 'a soma 10 > 8 deveria ser recusada');
    assert.match((await res.json()).error, /Estoque insuficiente/);

    await produto.reload();
    assert.equal(produto.estoque, 8, 'nada deveria ter sido baixado');

    await produto.destroy();
    await alvo.destroy();
});

test('pedido válido com produto repetido soma e baixa corretamente', async (t) => {
    if (pular()) return t.skip('banco de testes indisponível');

    const cliente = criarCliente(baseUrl);
    await fazerLogin(cliente);
    const csrf = await extrairCsrf(cliente, '/produtos');

    const produto = await Produto.create({
        nome: 'Carvão Teste Soma', preco: 10, peso_kg: 5, estoque: 10,
    });
    const { Cliente } = require('../models');
    const alvo = await Cliente.create({ nome: 'Cli Soma', email: `soma${Date.now()}@t.com`, documento: String(Date.now()).slice(-11) });

    const res = await cliente('/pedidos', {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: {
            _csrf: csrf,
            cliente_id: alvo.id,
            forma_pagamento: 'pix',
            'itens[0][produto_id]': produto.id,
            'itens[0][quantidade]': 4,
            'itens[1][produto_id]': produto.id,
            'itens[1][quantidade]': 6,
        },
    });

    assert.equal(res.status, 201, `esperava 201, veio ${res.status}`);
    const { pedido } = await res.json();

    // 10 unidades a R$ 10,00
    assert.equal(Number(pedido.valor_total), 100, 'o total deve refletir 10 unidades a R$ 10');

    await produto.reload();
    assert.equal(produto.estoque, 0, 'o estoque deveria ter baixado 10 unidades');

    const { Pedido, ItemPedido } = require('../models');
    const itens = await ItemPedido.findAll({ where: { pedido_id: pedido.id } });
    assert.equal(itens.length, 1, 'as duas linhas do mesmo produto viram um item só');
    assert.equal(itens[0].quantidade, 10);

    await Pedido.destroy({ where: { id: pedido.id } });
    await produto.destroy();
    await alvo.destroy();
});

test('rebaixar um admin tira o acesso na sessão já aberta', async (t) => {
    if (pular()) return t.skip('banco de testes indisponível');

    const { User } = require('../models');
    const alvo = await User.create({
        username: `admin_${Date.now()}`,
        password: bcrypt.hashSync('Senha@123', 10),
        role: 'admin',
    });

    // Sessão separada, autenticada como o admin recém-criado
    const cliente = criarCliente(baseUrl);
    await fazerLogin(cliente, { username: alvo.username, password: 'Senha@123' });

    const antes = await cliente('/users');
    assert.equal(antes.status, 200, 'o admin deveria acessar /users antes do rebaixamento');

    // Rebaixa pelo usuário de teste, que é admin
    await User.update({ role: 'user' }, { where: { id: alvo.id } });

    // Regressão de escalada de privilégio: sem reidratar o papel a cada
    // requisição, a sessão guardava role='admin' até o TTL (2h) expirar.
    const depois = await cliente('/users');
    assert.equal(depois.status, 403, 'o admin rebaixado não deveria mais acessar /users');

    await alvo.destroy();
});

test('conta removida derruba a sessão em vez de deixar userId órfão', async (t) => {
    if (pular()) return t.skip('banco de testes indisponível');

    const { User } = require('../models');
    const alvo = await User.create({
        username: `efemero_${Date.now()}`,
        password: bcrypt.hashSync('Senha@123', 10),
        role: 'user',
    });

    const cliente = criarCliente(baseUrl);
    await fazerLogin(cliente, { username: alvo.username, password: 'Senha@123' });

    await User.destroy({ where: { id: alvo.id } });

    const res = await cliente('/produtos');
    assert.equal(res.status, 302, 'sessão órfã deveria redirecionar para o login');
    assert.match(res.headers.get('location'), /^\/login/);
});

test('cliente com pedidos não pode ser excluído (RESTRICT no banco)', async (t) => {
    if (pular()) return t.skip('banco de testes indisponível');

    const { Cliente } = require('../models');
    const cliente = criarCliente(baseUrl);
    await fazerLogin(cliente);
    const csrf = await extrairCsrf(cliente, '/produtos');

    const alvo = await Cliente.create({
        nome: 'Cliente Com Pedido', email: `cped${Date.now()}@t.com`, documento: String(Date.now()).slice(-11),
    });
    const produto = await Produto.create({ nome: 'P Teste FK', preco: 10, peso_kg: 1, estoque: 5 });

    const criado = await cliente('/pedidos', {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: {
            _csrf: csrf,
            cliente_id: alvo.id,
            forma_pagamento: 'pix',
            'itens[0][produto_id]': produto.id,
            'itens[0][quantidade]': 1,
        },
    });
    assert.equal(criado.status, 201);

    const res = await cliente(`/clientes/${alvo.id}?_method=DELETE`, {
        method: 'POST',
        headers: { Accept: 'text/html' },
        body: { _csrf: csrf },
    });
    // O controller recusa antes de chegar no banco e devolve o usuário à
    // listagem com a mensagem, em vez de uma página de texto puro.
    assert.equal(res.status, 302);
    assert.match(res.headers.get('location'), /^\/clientes\?erro=/);

    // E o banco também: a FK é RESTRICT desde a 20260930000002
    await assert.rejects(
        () => Cliente.destroy({ where: { id: alvo.id } }),
        // O erro do Postgres é 23001 (restrict_violation), embrulhado em
        // SequelizeDatabaseError — não sai como "foreign key" no nome, e sim
        // na mensagem do erro interno.
        (err) => {
            const codigo = err.original?.code || err.parent?.code;
            return codigo === '23001' || /RESTRICT setting/.test(err.parent?.message || err.message);
        },
        'a FK deveria impedir a exclusão em cascata'
    );

    const { Pedido } = require('../models');
    await Pedido.destroy({ where: { cliente_id: alvo.id } });
    await produto.destroy();
    await alvo.destroy();
});

// ---------------------------------------------------------------------------
// UI web de pedidos (HTML) — mesma rota, mesmo serviço, formato diferente
// ---------------------------------------------------------------------------

const navegador = (p) => ({ ...p, headers: { Accept: 'text/html,application/xhtml+xml,*/*;q=0.8', ...(p.headers || {}) } });

// Cria os dados mínimos de um pedido e devolve os ids, já com estoque
// suficiente para duas unidades.
const cenarioPedido = async (sufixo) => {
    const { Cliente, Produto, Pedido } = require('../models');
    const produto = await Produto.create({
        nome: `Carvão UI ${sufixo}`, preco: 12.5, peso_kg: 5, estoque: 20,
    });
    const alvo = await Cliente.create({
        nome: `Cli UI ${sufixo}`,
        email: `ui${sufixo}@teste.com`,
        documento: String(Date.now()).slice(-11),
    });
    return { produto, cliente: alvo, Pedido };
};

test('/pedidos devolve HTML para o navegador e JSON para a API no mesmo path', async (t) => {
    if (pular()) return t.skip('banco de testes indisponível');

    const cliente = criarCliente(baseUrl);
    await fazerLogin(cliente);

    const html = await cliente('/pedidos', navegador({}));
    assert.equal(html.status, 200);
    assert.match(html.headers.get('content-type'), /text\/html/);
    assert.match(await html.text(), /<h1[^>]*>Pedidos<\/h1>/);

    // A API continua answering JSON sem parâmetro novo: é o mesmo contrato.
    const json = await cliente('/pedidos', { headers: { Accept: 'application/json' } });
    assert.equal(json.status, 200);
    assert.match(json.headers.get('content-type'), /application\/json/);
    assert.ok((await json.json()).pedidos);
});

test('?format=html e ?format=json desempatam quem não manda Accept', async (t) => {
    if (pular()) return t.skip('banco de testes indisponível');

    const cliente = criarCliente(baseUrl);
    await fazerLogin(cliente);

    // curl sem cabeçalho manda */*: a API precisa continuar JSON.
    const padrao = await cliente('/pedidos');
    assert.match(padrao.headers.get('content-type'), /application\/json/);

    const forcado = await cliente('/pedidos?format=html');
    assert.match(forcado.headers.get('content-type'), /text\/html/);

    const forcadoJson = await cliente('/pedidos?format=json');
    assert.match(forcadoJson.headers.get('content-type'), /application\/json/);
});

test('formulário de novo pedido abre com linhas de item e opções carregadas', async (t) => {
    if (pular()) return t.skip('banco de testes indisponível');

    const { produto, cliente: alvo, Pedido } = await cenarioPedido('form');

    try {
        const nav = criarCliente(baseUrl);
        await fazerLogin(nav);
        const res = await nav('/pedidos/new', navegador({}));

        assert.equal(res.status, 200);
        const html = await res.text();

        assert.match(html, /name="cliente_id"/);
        assert.match(html, /name="forma_pagamento"/);
        assert.match(html, /name="item_produto_id\[\]"/);
        assert.match(html, /name="item_quantidade\[\]"/);

        // Linhas fixas, sem JavaScript: 6 selects de produto.
        assert.equal(
            (html.match(/name="item_produto_id\[\]"/g) || []).length,
            require('../controllers/pedidoViewController').LINHAS_ITEM,
            'a view deveria renderizar as linhas fixas do formulário'
        );

        assert.match(html, new RegExp(alvo.nome), 'o cliente cadastrado deve aparecer no select');
        assert.match(html, new RegExp(produto.nome), 'o produto com estoque deve aparecer no select');
    } finally {
        await Pedido.destroy({ where: {} });
        await produto.destroy();
        await alvo.destroy();
    }
});

test('criar pedido pelo formulário baixa o estoque e redireciona para o pedido', async (t) => {
    if (pular()) return t.skip('banco de testes indisponível');

    const { produto, cliente: alvo, Pedido } = await cenarioPedido('criar');
    let pedidoId;

    try {
        const nav = criarCliente(baseUrl);
        await fazerLogin(nav);
        const csrf = await extrairCsrf(nav, '/pedidos/new');

        const res = await nav('/pedidos', navegador({
            method: 'POST',
            body: [
                ['_csrf', csrf],
                ['cliente_id', String(alvo.id)],
                ['forma_pagamento', 'pix'],
                // 1 linha preenchida + 2 vazias: as vazias não podem virar item.
                ['item_produto_id[]', String(produto.id)],
                ['item_quantidade[]', '2'],
                ['item_produto_id[]', ''],
                ['item_quantidade[]', ''],
                ['item_produto_id[]', ''],
                ['item_quantidade[]', ''],
            ],
        }));

        assert.equal(res.status, 302, `esperava redirect, veio ${res.status}`);
        const destino = res.headers.get('location');
        assert.match(destino, /^\/pedidos\/\d+\?msg=criado$/);

        pedidoId = Number(destino.match(/\/pedidos\/(\d+)/)[1]);
        const { ItemPedido } = require('../models');
        const pedido = await Pedido.findByPk(pedidoId, { include: [{ model: ItemPedido }] });
        assert.equal(pedido.status, 'pendente');
        assert.equal(Number(pedido.valor_total), 25, '2 unidades a R$ 12,50');
        assert.equal(pedido.ItemPedidos.length, 1, 'só a linha preenchida vira item');

        await produto.reload();
        assert.equal(produto.estoque, 18, '2 unidades devem ter saído do estoque');
    } finally {
        if (pedidoId) await Pedido.destroy({ where: { id: pedidoId } });
        await produto.destroy();
        await alvo.destroy();
    }
});

test('mesmo produto em duas linhas do formulário é somado, não duplicado', async (t) => {
    if (pular()) return t.skip('banco de testes indisponível');

    const { produto, cliente: alvo, Pedido } = await cenarioPedido('dup');
    let pedidoId;

    try {
        const nav = criarCliente(baseUrl);
        await fazerLogin(nav);
        const csrf = await extrairCsrf(nav, '/pedidos/new');

        const res = await nav('/pedidos', navegador({
            method: 'POST',
            body: [
                ['_csrf', csrf],
                ['cliente_id', String(alvo.id)],
                ['forma_pagamento', 'dinheiro'],
                ['item_produto_id[]', String(produto.id)],
                ['item_quantidade[]', '3'],
                ['item_produto_id[]', String(produto.id)],
                ['item_quantidade[]', '4'],
            ],
        }));

        assert.equal(res.status, 302);
        pedidoId = Number(res.headers.get('location').match(/\/pedidos\/(\d+)/)[1]);

        const { ItemPedido } = require('../models');
        const itens = await ItemPedido.findAll({ where: { pedido_id: pedidoId } });
        assert.equal(itens.length, 1, 'as duas linhas do mesmo produto viram um item');
        assert.equal(itens[0].quantidade, 7);

        await produto.reload();
        assert.equal(produto.estoque, 13, '3+4 = 7 unidades devem ter saído');
    } finally {
        if (pedidoId) await Pedido.destroy({ where: { id: pedidoId } });
        await produto.destroy();
        await alvo.destroy();
    }
});

test('estoque insuficiente no formulário volta o form com erro, sem pedido gravado', async (t) => {
    if (pular()) return t.skip('banco de testes indisponível');

    const { produto, cliente: alvo, Pedido } = await cenarioPedido('sem-estoque');
    const antes = await Pedido.count();

    try {
        const nav = criarCliente(baseUrl);
        await fazerLogin(nav);
        const csrf = await extrairCsrf(nav, '/pedidos/new');

        const res = await nav('/pedidos', navegador({
            method: 'POST',
            body: [
                ['_csrf', csrf],
                ['cliente_id', String(alvo.id)],
                ['forma_pagamento', 'pix'],
                ['item_produto_id[]', String(produto.id)],
                ['item_quantidade[]', '999'],
            ],
        }));

        // Reexibe o formulário (400) em vez de redirecionar: o usuário não
        // pode perder o que digitou por causa de um erro de estoque.
        assert.equal(res.status, 400);
        const html = await res.text();
        assert.match(html, /alert-danger/);
        assert.match(html, /Estoque insuficiente/);
        assert.equal(await Pedido.count(), antes, 'nenhum pedido pode ter sido criado');
    } finally {
        await produto.destroy();
        await alvo.destroy();
    }
});

test('meia linha preenchida no formulário é recusada', async (t) => {
    if (pular()) return t.skip('banco de testes indisponível');

    const { produto, cliente: alvo, Pedido } = await cenarioPedido('meia-linha');
    const antes = await Pedido.count();

    try {
        const nav = criarCliente(baseUrl);
        await fazerLogin(nav);
        const csrf = await extrairCsrf(nav, '/pedidos/new');

        const res = await nav('/pedidos', navegador({
            method: 'POST',
            body: [
                ['_csrf', csrf],
                ['cliente_id', String(alvo.id)],
                ['forma_pagamento', 'pix'],
                // produto sem quantidade: erro em vez de item com 1
                ['item_produto_id[]', String(produto.id)],
                ['item_quantidade[]', ''],
            ],
        }));

        assert.equal(res.status, 400);
        assert.match(await res.text(), /quantidade/i);
        assert.equal(await Pedido.count(), antes);
    } finally {
        await produto.destroy();
        await alvo.destroy();
    }
});

test('a página do pedido oferece só as transições válidas do status atual', async (t) => {
    if (pular()) return t.skip('banco de testes indisponível');

    const { produto, cliente: alvo, Pedido } = await cenarioPedido('status');
    let pedidoId;

    try {
        const nav = criarCliente(baseUrl);
        await fazerLogin(nav);
        const csrf = await extrairCsrf(nav, '/pedidos/new');

        const criado = await nav('/pedidos', navegador({
            method: 'POST',
            body: [
                ['_csrf', csrf],
                ['cliente_id', String(alvo.id)],
                ['forma_pagamento', 'pix'],
                ['item_produto_id[]', String(produto.id)],
                ['item_quantidade[]', '1'],
            ],
        }));
        pedidoId = Number(criado.headers.get('location').match(/\/pedidos\/(\d+)/)[1]);

        // De "pendente" só dá para processando ou cancelado.
        const res = await nav(`/pedidos/${pedidoId}`, navegador({}));
        const html = await res.text();
        assert.equal(res.status, 200);
        assert.match(html, /value="processando"/);
        assert.match(html, /value="cancelado"/);
        assert.doesNotMatch(html, /value="entregue"/, 'entregue não é alcançável a partir de pendente');
    } finally {
        if (pedidoId) await Pedido.destroy({ where: { id: pedidoId } });
        await produto.destroy();
        await alvo.destroy();
    }
});

test('mudar status pelo formulário usa a mesma regra da API', async (t) => {
    if (pular()) return t.skip('banco de testes indisponível');

    const { produto, cliente: alvo, Pedido } = await cenarioPedido('mudar');
    let pedidoId;

    try {
        const nav = criarCliente(baseUrl);
        await fazerLogin(nav);
        const csrf = await extrairCsrf(nav, '/pedidos/new');

        const criado = await nav('/pedidos', navegador({
            method: 'POST',
            body: [
                ['_csrf', csrf],
                ['cliente_id', String(alvo.id)],
                ['forma_pagamento', 'pix'],
                ['item_produto_id[]', String(produto.id)],
                ['item_quantidade[]', '5'],
            ],
        }));
        pedidoId = Number(criado.headers.get('location').match(/\/pedidos\/(\d+)/)[1]);

        // Transição inválida: pendente -> entregue
        const invalido = await nav(`/pedidos/${pedidoId}/status?_method=PUT`, navegador({
            method: 'POST',
            body: { _csrf: csrf, status: 'entregue' },
        }));
        assert.equal(invalido.status, 400);
        assert.match(await invalido.text(), /Transi..o inv.lida/);

        // Transição válida
        const valido = await nav(`/pedidos/${pedidoId}/status?_method=PUT`, navegador({
            method: 'POST',
            body: { _csrf: csrf, status: 'processando' },
        }));
        assert.equal(valido.status, 302);

        const pedido = await Pedido.findByPk(pedidoId);
        assert.equal(pedido.status, 'processando');
    } finally {
        if (pedidoId) await Pedido.destroy({ where: { id: pedidoId } });
        await produto.destroy();
        await alvo.destroy();
    }
});

test('cancelar pelo formulário devolve o estoque ao produto', async (t) => {
    if (pular()) return t.skip('banco de testes indisponível');

    const { produto, cliente: alvo, Pedido } = await cenarioPedido('cancelar');
    let pedidoId;

    try {
        const nav = criarCliente(baseUrl);
        await fazerLogin(nav);
        const csrf = await extrairCsrf(nav, '/pedidos/new');

        const criado = await nav('/pedidos', navegador({
            method: 'POST',
            body: [
                ['_csrf', csrf],
                ['cliente_id', String(alvo.id)],
                ['forma_pagamento', 'pix'],
                ['item_produto_id[]', String(produto.id)],
                ['item_quantidade[]', '6'],
            ],
        }));
        pedidoId = Number(criado.headers.get('location').match(/\/pedidos\/(\d+)/)[1]);

        await produto.reload();
        assert.equal(produto.estoque, 14, '6 unidades saíram do estoque de 20');

        const res = await nav(`/pedidos/${pedidoId}/status?_method=PUT`, navegador({
            method: 'POST',
            body: { _csrf: csrf, status: 'cancelado' },
        }));
        assert.equal(res.status, 302);

        await produto.reload();
        assert.equal(produto.estoque, 20, 'o cancelamento precisa devolver as 6 unidades');
    } finally {
        if (pedidoId) await Pedido.destroy({ where: { id: pedidoId } });
        await produto.destroy();
        await alvo.destroy();
    }
});

test('excluir pelo formulário devolve o estoque e volta para a lista', async (t) => {
    if (pular()) return t.skip('banco de testes indisponível');

    const { produto, cliente: alvo, Pedido } = await cenarioPedido('excluir');
    let pedidoId;

    try {
        const nav = criarCliente(baseUrl);
        await fazerLogin(nav);
        const csrf = await extrairCsrf(nav, '/pedidos/new');

        const criado = await nav('/pedidos', navegador({
            method: 'POST',
            body: [
                ['_csrf', csrf],
                ['cliente_id', String(alvo.id)],
                ['forma_pagamento', 'pix'],
                ['item_produto_id[]', String(produto.id)],
                ['item_quantidade[]', '4'],
            ],
        }));
        pedidoId = Number(criado.headers.get('location').match(/\/pedidos\/(\d+)/)[1]);

        const res = await nav(`/pedidos/${pedidoId}?_method=DELETE`, navegador({
            method: 'POST',
            body: { _csrf: csrf },
        }));

        assert.equal(res.status, 302);
        assert.equal(res.headers.get('location'), '/pedidos?msg=excluido');
        assert.equal(await Pedido.findByPk(pedidoId), null);

        await produto.reload();
        assert.equal(produto.estoque, 20, 'a exclusão precisa devolver as 4 unidades');
    } finally {
        if (pedidoId) await Pedido.destroy({ where: { id: pedidoId } });
        await produto.destroy();
        await alvo.destroy();
    }
});

test('filtro de status na listagem sobrevive à paginação', async (t) => {
    if (pular()) return t.skip('banco de testes indisponível');

    const nav = criarCliente(baseUrl);
    await fazerLogin(nav);

    const res = await nav('/pedidos?status=entregue&limit=1', navegador({}));
    assert.equal(res.status, 200);
    const html = await res.text();
    // Nenhum pedido entregue existe no cenário; o que importa é o link de
    // página carregar o filtro adiante, senão o usuário pagaria vendo tudo.
    assert.doesNotMatch(html, /href="\/pedidos\?page=\d+&limit=1"/,
        'link de paginação não pode descartar o filtro de status');
});

test('pedido inexistente devolve 404 em HTML', async (t) => {
    if (pular()) return t.skip('banco de testes indisponível');

    const nav = criarCliente(baseUrl);
    await fazerLogin(nav);

    const res = await nav('/pedidos/999999', navegador({}));
    assert.equal(res.status, 404);
    assert.match(res.headers.get('content-type'), /text\/html/);
});

test('relatório de vendas devolve resumo e não inclui pedido cancelado', async (t) => {
    if (pular()) return t.skip('banco de testes indisponível');

    const { produto, cliente: alvo, Pedido } = await cenarioPedido('relatorio');
    let pedidoId;

    try {
        const nav = criarCliente(baseUrl);
        await fazerLogin(nav);
        const csrf = await extrairCsrf(nav, '/pedidos/new');

        const criado = await nav('/pedidos', navegador({
            method: 'POST',
            body: [
                ['_csrf', csrf],
                ['cliente_id', String(alvo.id)],
                ['forma_pagamento', 'pix'],
                ['item_produto_id[]', String(produto.id)],
                ['item_quantidade[]', '2'],
            ],
        }));
        pedidoId = Number(criado.headers.get('location').match(/\/pedidos\/(\d+)/)[1]);

        const relatorio = await nav('/pedidos/relatorio/vendas', { headers: { Accept: 'application/json' } });
        assert.equal(relatorio.status, 200, 'o relatório não pode dar 500');
        const corpo = await relatorio.json();
        assert.ok(corpo.resumo, 'faltou o resumo');
        assert.equal(typeof corpo.resumo.total_vendas, 'number');
        assert.ok(corpo.pedidos.some((p) => Number(p.id) === pedidoId), 'o pedido novo deveria estar no relatório');

        // Cancelado não é venda: some do relatório
        await nav(`/pedidos/${pedidoId}/status?_method=PUT`, navegador({
            method: 'POST',
            body: [['_csrf', csrf], ['status', 'cancelado']],
        }));

        const depois = await nav('/pedidos/relatorio/vendas', { headers: { Accept: 'application/json' } });
        const corpoDepois = await depois.json();
        assert.ok(
            !corpoDepois.pedidos.some((p) => Number(p.id) === pedidoId),
            'pedido cancelado não pode aparecer como venda'
        );
    } finally {
        if (pedidoId) await Pedido.destroy({ where: { id: pedidoId } });
        await produto.destroy();
        await alvo.destroy();
    }
});

test('relatório com período exato filtra por data', async (t) => {
    if (pular()) return t.skip('banco de testes indisponível');

    const { produto, cliente: alvo, Pedido } = await cenarioPedido('periodo');
    let pedidoId;

    try {
        const nav = criarCliente(baseUrl);
        await fazerLogin(nav);
        const csrf = await extrairCsrf(nav, '/pedidos/new');

        const criado = await nav('/pedidos', navegador({
            method: 'POST',
            body: [
                ['_csrf', csrf],
                ['cliente_id', String(alvo.id)],
                ['forma_pagamento', 'pix'],
                ['item_produto_id[]', String(produto.id)],
                ['item_quantidade[]', '1'],
            ],
        }));
        pedidoId = Number(criado.headers.get('location').match(/\/pedidos\/(\d+)/)[1]);

        const hoje = new Date().toISOString().slice(0, 10);
        const dentro = await nav(
            `/pedidos/relatorio/vendas?dataInicio=${hoje}&dataFim=${hoje}`,
            { headers: { Accept: 'application/json' } }
        );
        assert.equal(dentro.status, 200);
        assert.ok((await dentro.json()).pedidos.some((p) => Number(p.id) === pedidoId));

        // Período só com uma das pontas é erro de uso, não 500
        const incompleto = await nav('/pedidos/relatorio/vendas?dataInicio=2020-01-01', {
            headers: { Accept: 'application/json' },
        });
        assert.equal(incompleto.status, 400);
    } finally {
        if (pedidoId) await Pedido.destroy({ where: { id: pedidoId } });
        await produto.destroy();
        await alvo.destroy();
    }
});

// ---------------------------------------------------------------------------
// Exclusão bloqueada por FK: volta para a listagem com a mensagem, em vez de
// devolver texto puro no meio da interface
// ---------------------------------------------------------------------------

test('excluir cliente com pedidos volta à lista com a mensagem de erro', async (t) => {
    if (pular()) return t.skip('banco de testes indisponível');

    const { produto, cliente: alvo, Pedido } = await cenarioPedido('fk-cliente');
    let pedidoId;

    try {
        const nav = criarCliente(baseUrl);
        await fazerLogin(nav);
        const csrf = await extrairCsrf(nav, '/pedidos/new');

        const criado = await nav('/pedidos', navegador({
            method: 'POST',
            body: [
                ['_csrf', csrf],
                ['cliente_id', String(alvo.id)],
                ['forma_pagamento', 'pix'],
                ['item_produto_id[]', String(produto.id)],
                ['item_quantidade[]', '1'],
            ],
        }));
        pedidoId = Number(criado.headers.get('location').match(/\/pedidos\/(\d+)/)[1]);

        const res = await nav(`/clientes/${alvo.id}?_method=DELETE`, navegador({
            method: 'POST',
            body: { _csrf: csrf },
        }));

        assert.equal(res.status, 302, 'deveria redirecionar, não responder texto puro');
        const destino = res.headers.get('location');
        assert.match(destino, /^\/clientes\?erro=/);

        // A mensagem diz que é preciso EXCLUIR os pedidos: cancelar não resolve,
        // porque o cancelamento não remove o vínculo com o cliente.
        const aviso = decodeURIComponent(destino.split('erro=')[1]);
        assert.match(aviso, /excluir/i);
        assert.match(aviso, /cancel[aá]?-?l?os? não basta/i);

        // E a listagem mostra a mensagem num alert, escapada
        const lista = await nav(destino, navegador({}));
        assert.equal(lista.status, 200);
        const html = await lista.text();
        assert.match(html, /alert-danger/);
        assert.match(html, /cancel[aá]?-?l?os? não basta/i);
    } finally {
        if (pedidoId) await Pedido.destroy({ where: { id: pedidoId } });
        await produto.destroy();
        await alvo.destroy();
    }
});

test('excluir categoria com produtos volta à lista com a mensagem', async (t) => {
    if (pular()) return t.skip('banco de testes indisponível');

    const nav = criarCliente(baseUrl);
    await fazerLogin(nav);
    const csrf = await extrairCsrf(nav, '/produtos');

    const { Categoria, Produto } = require('../models');
    const categoria = await Categoria.create({ nome: `Cat ${Date.now()}` });
    const produto = await Produto.create({
        nome: `Prod cat ${Date.now()}`, preco: 10, peso_kg: 1, estoque: 5, categoria_id: categoria.id,
    });

    try {
        const res = await nav(`/categorias/${categoria.id}?_method=DELETE`, navegador({
            method: 'POST',
            body: { _csrf: csrf },
        }));

        assert.equal(res.status, 302);
        const destino = res.headers.get('location');
        assert.match(destino, /^\/categorias\?erro=/);
        assert.match(decodeURIComponent(destino.split('erro=')[1]), /produtos vinculados/i);

        const lista = await nav(destino, navegador({}));
        assert.match(await lista.text(), /alert-danger/);
    } finally {
        await produto.destroy();
        await categoria.destroy();
    }
});

test('excluir produto com pedidos volta à lista com a mensagem', async (t) => {
    if (pular()) return t.skip('banco de testes indisponível');

    const { produto, cliente: alvo, Pedido } = await cenarioPedido('fk-produto');
    let pedidoId;

    try {
        const nav = criarCliente(baseUrl);
        await fazerLogin(nav);
        const csrf = await extrairCsrf(nav, '/pedidos/new');

        const criado = await nav('/pedidos', navegador({
            method: 'POST',
            body: [
                ['_csrf', csrf],
                ['cliente_id', String(alvo.id)],
                ['forma_pagamento', 'pix'],
                ['item_produto_id[]', String(produto.id)],
                ['item_quantidade[]', '1'],
            ],
        }));
        pedidoId = Number(criado.headers.get('location').match(/\/pedidos\/(\d+)/)[1]);

        const res = await nav(`/produtos/${produto.id}?_method=DELETE`, navegador({
            method: 'POST',
            body: { _csrf: csrf },
        }));

        assert.equal(res.status, 302);
        assert.match(res.headers.get('location'), /^\/produtos\?erro=/);
        assert.match(decodeURIComponent(res.headers.get('location').split('erro=')[1]), /pedidos registrados/i);
    } finally {
        if (pedidoId) await Pedido.destroy({ where: { id: pedidoId } });
        await produto.destroy();
        await alvo.destroy();
    }
});

test('a mensagem de erro na query é escapada, não interpretada como HTML', async (t) => {
    if (pular()) return t.skip('banco de testes indisponível');

    const nav = criarCliente(baseUrl);
    await fazerLogin(nav);

    // Injeção direta na query: se a view usasse <%- %>, o script entraria no
    // HTML. O <%= %> tem que escapar.
    const res = await nav('/clientes?erro=' + encodeURIComponent('<script>alert(1)</script>'), navegador({}));
    assert.equal(res.status, 200);
    const html = await res.text();

    assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/, 'o HTML não pode conter a tag crua');
    assert.match(html, /&lt;script&gt;/, 'o texto deve aparecer escapado');
});

test('produto com categoria_id inexistente devolve o formulário com erro, não 500', async (t) => {
    if (pular()) return t.skip('banco de testes indisponível');

    const nav = criarCliente(baseUrl);
    await fazerLogin(nav);
    const csrf = await extrairCsrf(nav, '/produtos/new');

    // categoria_id que não existe: o banco recusa o INSERT com 23503. A
    // checagem pelo nome da classe Sequel nunca casava, então isso virava 500.
    const res = await nav('/produtos', navegador({
        method: 'POST',
        body: [
            ['_csrf', csrf],
            ['nome', 'Produto sem categoria'],
            ['preco', '10,00'],
            ['peso_kg', '1'],
            ['estoque', '3'],
            ['categoria_id', '999999'],
        ],
    }));

    assert.equal(res.status, 400, `esperava 400, veio ${res.status}`);
    const html = await res.text();
    assert.match(html, /categoria informada não existe/i);
    assert.doesNotMatch(html, /Erro interno/, 'não pode cair na página de 500');
});
