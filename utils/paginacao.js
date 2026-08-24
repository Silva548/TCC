// Paginação por offset com limites seguros
const LIMITE_PADRAO = 20;
const LIMITE_MAXIMO = 50;

const parsePaginacao = (query = {}) => {
    const pagina = Math.max(1, parseInt(query.page, 10) || 1);
    const limite = Math.min(LIMITE_MAXIMO, Math.max(1, parseInt(query.limit, 10) || LIMITE_PADRAO));
    return {
        pagina,
        limite,
        offset: (pagina - 1) * limite,
    };
};

// Metadados para views/respostas JSON
const metadados = ({ pagina, limite }, total) => ({
    pagina,
    limite,
    total,
    total_paginas: Math.ceil(total / limite),
});

module.exports = { parsePaginacao, metadados };
