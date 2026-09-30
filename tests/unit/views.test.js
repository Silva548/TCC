const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ejs = require('ejs');

const VIEWS = path.join(__dirname, '..', '..', 'views');
const ler = (rel) => fs.readFileSync(path.join(VIEWS, rel), 'utf8');

const caminho = (rel) => path.join(VIEWS, rel);

// Tags <link>/<script> inteiras, inclusive atributos quebrados em várias linhas.
const tagsExternas = (html) => [...html.matchAll(/<(?:link|script)\b[^>]*>/g)]
    .map((m) => m[0])
    .filter((tag) => /https?:\/\//.test(tag));

test('todo recurso externo do layout tem SRI e crossorigin', () => {
    const externas = tagsExternas(ler('layout.ejs'));
    assert.ok(externas.length > 0, 'o layout deveria carregar recursos externos');

    for (const tag of externas) {
        assert.match(tag, /integrity="sha(?:256|384|512)-[A-Za-z0-9+/]+={0,2}"/,
            `recurso sem Subresource Integrity: ${tag}`);
        // Sem crossorigin o navegador busca sem CORS, a resposta não tem
        //_dims verificáveis e o SRI é ignorado com warning no console.
        assert.match(tag, /crossorigin="anonymous"/,
            `recurso sem crossorigin (SRI seria ignorado): ${tag}`);
    }
});

test('nenhum host de CDN legado sobrevive no layout', () => {
    // code.jquery.com e maxcdn.bootstrapcdn.com eram as origens sem SRI;
    // a CSP de app.js foi reduzida para jsdelivr, então usá-los de novo
    // quebraria a página em silêncio.
    const layout = ler('layout.ejs');
    assert.doesNotMatch(layout, /maxcdn\.bootstrapcdn\.com/);
    assert.doesNotMatch(layout, /code\.jquery\.com/);
});

test('as views de erro nao escapam o objeto Error', () => {
    for (const view of ['500.ejs', '404.ejs']) {
        // <%= %> escapa. O perigo seria <%- %> com o Error inteiro, que
        // serializaria a stack e as linhas do arquivo-fonte.
        assert.doesNotMatch(ler(view), /<%-\s*erro\s*%>/,
            `${view} usa <%- %> em 'erro': a stack pode vazar`);
    }
});

test('a div do container e fechada no layout', () => {
    const html = ejs.render(ler('layout.ejs'), { body: '<p>x</p>', currentUser: null },
        { filename: caminho('layout.ejs') });

    const abertos = (html.match(/<div\b/g) || []).length;
    const fechados = (html.match(/<\/div>/g) || []).length;

    assert.equal(abertos, fechados, 'div desbalanceada no HTML final');
    assert.match(html, /<\/body>/);
    assert.match(html, /<\/html>/);
});

test('a paginacao nao emite link desabilitado', () => {
    // Com <a> dentro de .disabled, o HTML ainda oferecia "?page=0" e o leitor
    // de tela anunciava um link ativo. Desabilitado tem de ser <span>.
    const fonte = ler('partials/pagination.ejs');

    assert.match(fonte, /page-item disabled[\s\S]{0,200}?<span class="page-link"/,
        'estado desabilitado deveria renderizar <span>, nao <a>');
    assert.doesNotMatch(fonte, /aria-label="Anterior"/,
        'o rotulo do botao anterior deve ser "Pagina anterior"');
});

test('a pagina 500 mostra o requestId quando o erro fornece um', () => {
    const html = ejs.render(ler('500.ejs'), { erro: 'Erro interno do servidor', requestId: 'abc-123' });
    assert.match(html, /abc-123/);
});