// Formatação para exibição. Tudo aqui devolve string: as views usam <%= %>,
// que escapa, então o valor nunca é injetado como HTML.

const MOEDAS = { BRL: 'BRL' };

const numero = (valor, casas = 2) =>
    Number(valor || 0).toLocaleString('pt-BR', {
        minimumFractionDigits: casas,
        maximumFractionDigits: casas,
    });

const moeda = (valor) => `R$ ${numero(valor)}`;

const dataHora = (valor) => {
    if (!valor) return '-';
    const d = new Date(valor);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
};

const ROTULOS_STATUS = {
    pendente: 'Pendente',
    processando: 'Processando',
    enviado: 'Enviado',
    entregue: 'Entregue',
    cancelado: 'Cancelado',
};

const ROTULOS_PAGAMENTO = {
    credito: 'Crédito',
    debito: 'Débito',
    pix: 'PIX',
    boleto: 'Boleto',
    dinheiro: 'Dinheiro',
};

const rotuloStatus = (status) => ROTULOS_STATUS[status] || status || '-';

const rotuloPagamento = (forma) => ROTULOS_PAGAMENTO[forma] || forma || '-';

// Classe do badge Bootstrap, para o status ficar identificável de longe.
const CLASSE_STATUS = {
    pendente: 'badge-warning',
    processando: 'badge-info',
    enviado: 'badge-primary',
    entregue: 'badge-success',
    cancelado: 'badge-danger',
};

const classeStatus = (status) => CLASSE_STATUS[status] || 'badge-secondary';

module.exports = {
    MOEDAS,
    numero,
    moeda,
    dataHora,
    rotuloStatus,
    rotuloPagamento,
    classeStatus,
    ROTULOS_STATUS,
    ROTULOS_PAGAMENTO,
};
