// Limites de tamanho espelhando as migrations.
//
// Sem isto, um campo maior que a coluna estourava o Postgres com
// "value too long for type character varying(255)" — um erro de tipo que o
// errorHandler transformava em HTTP 500. Ou seja, entrada de usuário simples
// produzia uma página de erro do servidor em vez de um 400 com mensagem útil.
//
// Os valores NÃO são arbitrários: foram lidos das migrations, que é a fonte
// da verdade. Se mudar uma coluna lá, mude aqui.
const LIMITE_STRING = {
    cliente: {
        nome: 255,
        email: 255,
        documento: 20,
        telefone: 20,
    },
    produto: {
        nome: 255,
        categoria: 255,
        embalagem: 20,
    },
    categoria: {
        nome: 255,
    },
    usuario: {
        username: 100,
    },
};

// Faixas dos DECIMALs, em reais/quilogramas. DECIMAL(10,2) aceita no máximo
// 99.999.999,99; DECIMAL(8,2), 999.999,99. Acima disso o Postgres responde
// "numeric field overflow" — outra vez 500 em vez de 400.
const FAIXA_DECIMAL = {
    preco_entrega: { max: 99999999.99 },
    preco_retirada: { max: 99999999.99 },
    peso_kg: { max: 999999.99 },
    valor_total: { max: 9999999999.99 },
};

// true quando o valor é um texto que cabe no limite. Valores não-string
// devolvem false e são ignorados por excedeTexto: quem decide se um número é
// válido é o controller, não esta função.
const textoDentroDoLimite = (valor, max) => typeof valor === 'string' && valor.length <= max;

// Devolve uma mensagem de erro, ou null quando o valor cabe.
const erroLimite = (campo, max, unidade = 'caracteres') =>
    `${campo} deve ter no máximo ${max} ${unidade}`;

const excedeTexto = (entidade, campo, valor) => {
    const max = LIMITE_STRING[entidade]?.[campo];
    if (!max) return null;
    if (typeof valor !== 'string') return null;
    if (textoDentroDoLimite(valor, max)) return null;
    return erroLimite(campo, max);
};

const excedeDecimal = (campo, valor) => {
    const faixa = FAIXA_DECIMAL[campo];
    if (!faixa) return null;
    const numero = Number(valor);
    if (!Number.isFinite(numero)) return null;
    if (numero <= faixa.max) return null;
    return `${campo} deve ser no máximo ${faixa.max}`;
};

module.exports = { LIMITE_STRING, FAIXA_DECIMAL, textoDentroDoLimite, excedeTexto, excedeDecimal, erroLimite };