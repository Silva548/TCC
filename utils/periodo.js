// Períodos de data para relatórios — módulo puro, sem dependência de banco.

const FORMATO_DATA = /^\d{4}-\d{2}-\d{2}$/;

// new Date('AAAA-MM-DD') é interpretado como UTC midnight, que em
// America/Sao_Paulo equivale a 21:00 do dia ANTERIOR. Construindo a data com
// 'T00:00:00' o parse é feito no fuso local e o dia deixa de ser deslocado.
const inicioDoDia = (iso) => new Date(`${iso}T00:00:00`);

// Rejeita datas que o JavaScript ajustaria silenciosamente para outra data
// (ex.: 2026-02-30 vira 02/03, 2026-13-01 vira 01/01 do ano seguinte).
const ehDataValida = (iso) => {
    if (typeof iso !== 'string' || !FORMATO_DATA.test(iso)) {
        return false;
    }

    const data = inicioDoDia(iso);
    if (Number.isNaN(data.getTime())) {
        return false;
    }

    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');
    return `${data.getFullYear()}-${mes}-${dia}` === iso;
};

// Devolve o intervalo semiaberto [inicio, fim) para uso com Op.gte / Op.lt.
// O fim exclusivo é o início do dia seguinte, o que cobre o dia inteiro sem
// depender de hora — um between com 23:59:59 perderia os últimos milissegundos,
// e um between com o mesmo dia nos dois extremos resultaria em janela vazia.
const periodoRelatorio = (dataInicio, dataFim) => {
    if (!ehDataValida(dataInicio) || !ehDataValida(dataFim)) {
        return { erro: 'Datas inválidas. Use o formato AAAA-MM-DD' };
    }

    const inicio = inicioDoDia(dataInicio);
    const fim = inicioDoDia(dataFim);
    fim.setDate(fim.getDate() + 1);

    if (inicio >= fim) {
        return { erro: 'dataInicio deve ser anterior ou igual a dataFim' };
    }

    return { inicio, fim };
};

module.exports = { FORMATO_DATA, inicioDoDia, ehDataValida, periodoRelatorio };
