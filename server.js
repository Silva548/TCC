// Ponto de entrada do servidor. Fica separado de app.js para que o app possa ser
// importado por testes sem subir um listener nem prender a porta 3000.
const app = require('./app');
const { sequelize, sessionPool } = require('./config/db');

const PORT = process.env.PORT || 3000;

const iniciar = async () => {
    try {
        await sequelize.authenticate();
    } catch (err) {
        console.error('Falha ao conectar ao banco de dados:', err.message);
        console.error('Aplique as migrations antes de iniciar: npm run migrate');
        process.exit(1);
    }

    const server = app.listen(PORT, () => {
        console.log(`Conectado ao PostgreSQL. Server is running on port ${PORT}`);
    });

    // Encerramento gracioso: fecha o listener e as conexões antes de sair,
    // para não deixar transações penduradas nem conexões órfãs
    const encerrar = (sinal) => async () => {
        console.log(`\n${sinal} recebido, encerrando...`);
        server.close(async () => {
            try {
                await sequelize.close();
                await sessionPool.end();
            } catch (err) {
                console.error('Erro ao fechar conexões:', err.message);
            }
            process.exit(0);
        });
    };

    process.on('SIGTERM', encerrar('SIGTERM'));
    process.on('SIGINT', encerrar('SIGINT'));
};

iniciar();
