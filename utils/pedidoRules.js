// Regras de negócio de pedidos — módulo puro, sem dependência de banco

const STATUS_VALIDOS = ['pendente', 'processando', 'enviado', 'entregue', 'cancelado'];
const FORMAS_PAGAMENTO = ['credito', 'debito', 'pix', 'boleto', 'dinheiro'];

// Modalidade do pedido. Cada produto tem um preço para cada uma; a escolha
// acontece no pedido, não no produto, porque o mesmo carvão pode ser entregue
// ou retirado.
const TIPOS_ENTREGA = ['entrega', 'retirada'];
const MODALIDADE_PADRAO = 'entrega';

// Coluna de preço correspondente a cada modalidade
const COLUNA_PRECO = {
    entrega: 'preco_entrega',
    retirada: 'preco_retirada',
};

const modalidadeValida = (tipo) => TIPOS_ENTREGA.includes(tipo);

// Preço do produto na modalidade do pedido. Modalidade desconhecida cai no
// padrão em vez de devolver undefined e contaminar o total com NaN.
const precoDaModalidade = (produto, tipoEntrega) =>
    produto[COLUNA_PRECO[modalidadeValida(tipoEntrega) ? tipoEntrega : MODALIDADE_PADRAO]];

// Transições permitidas entre status de pedido
const TRANSICOES_STATUS = {
    pendente: ['processando', 'cancelado'],
    processando: ['enviado', 'cancelado'],
    enviado: ['entregue', 'cancelado'],
    entregue: [],
    cancelado: [],
};

const transicaoValida = (atual, novo) =>
    Boolean(STATUS_VALIDOS.includes(novo) && TRANSICOES_STATUS[atual] && TRANSICOES_STATUS[atual].includes(novo));

// Trabalha em centavos (inteiros) para evitar erros de arredondamento binário
const paraCentavos = (valorDecimal) => Math.round(parseFloat(valorDecimal) * 100);

// Média por pedido raramente fecha em centavos: 310 / 7 dá
// 44.285714285714285, e um campo de dinheiro com 17 dígitos significativos vira
// lixo na tela e no JSON consumido por outro sistema. Arredonda na fronteira,
// depois da divisão — arredondar antes mudaria o resultado.
const mediaEmCentavos = (total, quantidade) => {
    const n = Number(quantidade);
    if (!Number.isFinite(Number(total)) || !Number.isFinite(n) || n <= 0) {
        return 0;
    }
    return Math.round((Number(total) / n) * 100) / 100;
};

// itens:   [{ produto_id, quantidade }]
// produtos: Map<produto_id, { preco_entrega, preco_retirada }>
// tipoEntrega: 'entrega' | 'retirada' (define qual preço do produto vale)
//
// O preço é buscado pelo id, e não pela posição no array: quando o mesmo
// produto aparece em mais de uma linha, a agregação muda o tamanho da lista e
// qualquer alinhamento posicional passaria a associar quantidade ao preço
// errado — ou estourar o array e devolver NaN.
const calcularTotalCentavos = (itens, produtos, tipoEntrega = MODALIDADE_PADRAO) =>
    itens.reduce(
        (acc, item) =>
            acc +
            paraCentavos(precoDaModalidade(produtos.get(item.produto_id), tipoEntrega)) *
                Number(item.quantidade),
        0
    );

module.exports = {
    STATUS_VALIDOS,
    FORMAS_PAGAMENTO,
    TIPOS_ENTREGA,
    MODALIDADE_PADRAO,
    TRANSICOES_STATUS,
    transicaoValida,
    modalidadeValida,
    precoDaModalidade,
    paraCentavos,
    mediaEmCentavos,
    calcularTotalCentavos,
};
