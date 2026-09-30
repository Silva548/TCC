const { test } = require('node:test');
const assert = require('node:assert');
const { FORMATO_DATA, inicioDoDia, ehDataValida, periodoRelatorio } = require('../../utils/periodo');

test('formato aceito é estrito AAAA-MM-DD', () => {
    ['2026-01-01', '2026-12-31'].forEach((d) => assert.equal(FORMATO_DATA.test(d), true, d));
    ['01/01/2026', '2026-1-1', '2026-01-01T00:00', '20260101', '', null, undefined, 20260101]
        .forEach((d) => assert.equal(FORMATO_DATA.test(d), false, String(d)));
});

test('inicioDoDia usa fuso local, não UTC', () => {
    // new Date('2026-08-24') seria 2026-08-24T00:00:00Z, ou seja 21:00 de 23/08
    // em America/Sao_Paulo — o relatório começaria um dia antes.
    const d = inicioDoDia('2026-08-24');
    assert.equal(d.getFullYear(), 2026);
    assert.equal(d.getMonth(), 7);
    assert.equal(d.getDate(), 24);
    assert.equal(d.getHours(), 0);
    assert.equal(d.getMinutes(), 0);
});

test('datas que o JS ajustaria silenciosamente são rejeitadas', () => {
    ['2026-02-30', '2026-13-01', '2026-00-10', '2026-04-31'].forEach((d) => {
        assert.equal(ehDataValida(d), false, `${d} deveria ser inválida`);
    });
});

test('datas reais são aceitas, inclusive em ano bissexto', () => {
    ['2026-02-28', '2024-02-29', '2026-01-31', '2026-12-31'].forEach((d) => {
        assert.equal(ehDataValida(d), true, `${d} deveria ser válida`);
    });
});

test('entrada não-string é rejeitada sem lançar erro', () => {
    [null, undefined, 20260101, {}, [], true].forEach((d) => {
        assert.equal(ehDataValida(d), false, String(d));
    });
});

test('intervalo de um único dia é não-vazio e semiaberto', () => {
    // Regressão: Op.between com o mesmo dia nos dois extremos dava janela vazia.
    const { erro, inicio, fim } = periodoRelatorio('2026-08-24', '2026-08-24');
    assert.equal(erro, undefined);
    assert.equal(inicio.getTime() < fim.getTime(), true, 'janela de 1 dia não pode ser vazia');
    assert.equal(inicio.getDate(), 24);
    assert.equal(fim.getDate(), 25, 'fim exclusivo deve ser o início do dia seguinte');
    assert.equal(fim.getHours(), 0);
});

test('período de vários dias abrange o dia final inteiro', () => {
    const { erro, inicio, fim } = periodoRelatorio('2026-08-01', '2026-08-31');
    assert.equal(erro, undefined);
    assert.equal(inicio.getDate(), 1);
    assert.equal(inicio.getMonth(), 7);
    assert.equal(fim.getMonth(), 8, 'setembro');
    assert.equal(fim.getDate(), 1);
});

test('período que atravessa a virada de ano', () => {
    const { inicio, fim } = periodoRelatorio('2025-12-30', '2026-01-02');
    assert.equal(inicio.getFullYear(), 2025);
    assert.equal(fim.getFullYear(), 2026);
    assert.equal(fim.getMonth(), 0);
    assert.equal(fim.getDate(), 3);
});

test('datas ou ordem inválidas retornam erro em vez de exceção', () => {
    assert.match(periodoRelatorio('ontem', 'hoje').erro, /AAAA-MM-DD/);
    assert.match(periodoRelatorio('2026-08-24', '2026-13-45').erro, /AAAA-MM-DD/);
    assert.match(periodoRelatorio(undefined, undefined).erro, /AAAA-MM-DD/);
    assert.match(periodoRelatorio('2026-08-24', '2026-08-01').erro, /anterior ou igual/);
});
