// Regras de negócio de pedidos — módulo puro, sem dependência de banco

const STATUS_VALIDOS = ['pendente', 'processando', 'enviado', 'entregue', 'cancelado'];
const FORMAS_PAGAMENTO = ['credito', 'debito', 'pix', 'boleto', 'dinheiro'];

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

// itens:   [{ produto_id, quantidade }]
// produtos: Map<produto_id, { preco }>
//
// O preço é buscado pelo id, e não pela posição no array: quando o mesmo
// produto aparece em mais de uma linha, a agregação muda o tamanho da lista e
// qualquer alinhamento posicional passaria a associar quantidade ao preço
// errado — ou estourar o array e devolver NaN.
const calcularTotalCentavos = (itens, produtos) =>
    itens.reduce(
        (acc, item) => acc + paraCentavos(produtos.get(item.produto_id).preco) * Number(item.quantidade),
        0
    );

module.exports = {
    STATUS_VALIDOS,
    FORMAS_PAGAMENTO,
    TRANSICOES_STATUS,
    transicaoValida,
    paraCentavos,
    calcularTotalCentavos,
};
