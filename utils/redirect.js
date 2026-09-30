// Validação de caminhos de redirecionamento (open redirect).
//
// O valor de returnTo vem de req.originalUrl, e o Node aceita request-target
// protocol-relative: `GET //evil.com/x` chega com originalUrl = "//evil.com/x".
// Um res.redirect() ingênuo com esse valor gera "Location: //evil.com/x", e o
// navegador navega para o site atacante. Por isso o caminho precisa ser
// validado antes de virar Location.

const ehCaminhoSeguro = (caminho) => {
    if (typeof caminho !== 'string' || caminho === '') {
        return false;
    }

    // Precisa começar com uma única barra: "//evil.com" é protocol-relative
    if (!caminho.startsWith('/') || caminho.startsWith('//')) {
        return false;
    }

    // Barra invertida e caracteres de controle permitiriam variações do header
    if (/[\r\n\\]/.test(caminho)) {
        return false;
    }

    // Rejeita URL absoluta com esquema (http://, javascript:, data: etc.)
    if (/^[a-z][a-z0-9+.-]*:/i.test(caminho)) {
        return false;
    }

    return true;
};

// Devolve o caminho quando seguro, senão o fallback informado.
const caminhoSeguro = (caminho, fallback = '/') => (ehCaminhoSeguro(caminho) ? caminho : fallback);

module.exports = { ehCaminhoSeguro, caminhoSeguro };
