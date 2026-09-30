const { sequelize } = require('../config/db');

// Sonda de saúde para orquestradores (Render, Railway, Docker, Kubernetes).
// Pública por definição: quem monitora não tem sessão do sistema.
const healthCheck = async (req, res) => {
    try {
        await sequelize.authenticate();
        res.status(200).json({ status: 'ok', database: 'up' });
    } catch (err) {
        console.error(`[Health][${req.id}] banco indisponível:`, err.message);
        res.status(503).json({ status: 'degraded', database: 'down' });
    }
};

module.exports = { healthCheck };
