// app.js - Exemplo de como integrar o Sequelize

const express = require('express');
const dotenv = require('dotenv');
const path = require('path');
const bodyParser = require('body-parser');
const methodOverride = require('method-override');
const expressEjsLayouts = require('express-ejs-layouts');

// Importar modelos e função de sincronização
const { syncDatabase } = require('./models/index');

// Carregar variáveis de ambiente
dotenv.config();

const app = express();

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressEjsLayouts);
app.set('layout', 'layouts/main');

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));

// Importar rotas
const produtoRoutes = require('./routes/produtoSequelizeRoutes');
const clienteRoutes = require('./routes/clienteRoutes');
const pedidoRoutes = require('./routes/pedidoRoutes');

// Usar rotas
app.use('/produtos', produtoRoutes);
app.use('/clientes', clienteRoutes);
app.use('/pedidos', pedidoRoutes);

// Rota inicial
app.get('/', (req, res) => {
    res.render('index');
});

// Sincronizar banco de dados e iniciar servidor
syncDatabase(false).then(() => {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
        console.log('Database synced');
    });
}).catch((err) => {
    console.error('Failed to sync database:', err);
});

module.exports = app;
