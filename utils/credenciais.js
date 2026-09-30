// Senhas padrão conhecidas, para recusar a aplicação em vez de confiar nelas.
const bcrypt = require('bcryptjs');

// O seed já gera senha aleatória em produção, mas o caminho mais comum até uma
// credencial previsível não passa por ele: alguém cria o banco em
// desenvolvimento (onde a senha é admin123), exporta um dump e promove para
// produção. O seed não roda de novo, porque é idempotente e o admin já existe —
// então o banco entra no ar com a senha padrão e nada avisa.
const SENHAS_PADRAO_CONHECIDAS = ['admin123'];

// Confere a senha em claro contra a lista. Compara com bcrypt porque não há
// como ler o hash de volta; a verificação custa um bcrypt.compare por senha.
const usaSenhaPadraoConhecida = async (user, senhas = SENHAS_PADRAO_CONHECIDAS) => {
    if (!user || !user.password || !Array.isArray(senhas) || senhas.length === 0) {
        return false;
    }

    for (const senha of senhas) {
        // bcrypt.compare não lança com hash malformado: devolve false. Mesmo
        // assim, um erro aqui não deve derrubar a checagem de segurança.
        if (await bcrypt.compare(senha, user.password).catch(() => false)) {
            return true;
        }
    }
    return false;
};

module.exports = { SENHAS_PADRAO_CONHECIDAS, usaSenhaPadraoConhecida };
