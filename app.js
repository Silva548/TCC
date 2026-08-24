require('dotenv').config();

const path = require('path');
const express = require('express');
const methodOverride = require('method-override');
const expressLayouts = require('express-ejs-layouts');
const session = require('express-session');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const indexRoutes = require('./routes/indexRoutes');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const produtoRoutes = require('./routes/produtoSequelizeRoutes');
const categoriaRoutes = require('./routes/categoriaRoutes');
const clienteRoutes = require('./routes/clienteRoutes');
const pedidoRoutes = require('./routes/pedidoRoutes');

const { requireAuth } = require('./middleware/auth');
const { csrfSetup, verifyCsrf } = require('./middleware/csrf');
const { syncDatabase } = require('./models/index');

const app = express();
const PORT = process.env.PORT || 3000;

if (!process.env.SESSION_SECRET && process.env.NODE_ENV === 'production') {
    console.error('SESSION_SECRET não definido. Configure-o no arquivo .env antes de rodar em produção.');
    process.exit(1);
}

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", 'maxcdn.bootstrapcdn.com'],
            scriptSrc: ["'self'", "'unsafe-inline'", 'code.jquery.com', 'cdn.jsdelivr.net', 'maxcdn.bootstrapcdn.com'],
            fontSrc: ["'self'", 'maxcdn.bootstrapcdn.com'],
            imgSrc: ["'self'", 'data:'],
        },
    },
}));

const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
});

app.use(globalLimiter);
app.use(express.json({ limit: '200kb' }));
app.use(express.urlencoded({ extended: true, limit: '200kb' }));
app.use(methodOverride('_method'));

app.use(session({
    secret: process.env.SESSION_SECRET || 'segredo-inseguro-apenas-desenvolvimento',
    name: 'sessionId',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 2 * 60 * 60 * 1000, // 2 horas
    },
}));

// Proteção CSRF para todas as rotas que alteram estado
app.use(csrfSetup);
app.use(verifyCsrf);

// Disponibiliza o usuário logado para todas as views
app.use((req, res, next) => {
    res.locals.currentUser = req.session.userId
        ? { id: req.session.userId, username: req.session.username, role: req.session.role }
        : null;
    next();
});

// Rotas públicas
app.use('/', authRoutes);
app.use('/', indexRoutes);

// Rotas protegidas (exigem autenticação)
app.use('/users', requireAuth, userRoutes);
app.use('/produtos', requireAuth, produtoRoutes);
app.use('/categorias', requireAuth, categoriaRoutes);
app.use('/clientes', requireAuth, clienteRoutes);
app.use('/pedidos', requireAuth, pedidoRoutes);

// 404 - rota não encontrada
app.use((req, res) => {
    if (req.accepts(['html', 'json']) === 'json') {
        return res.status(404).json({ error: 'Rota não encontrada' });
    }
    res.status(404).render('404');
});

// Tratamento central de erros (não vaza detalhes internos ao cliente)
app.use((err, req, res, next) => {
    console.error('[Erro]', err.status || 500, '-', err.message);

    const status = err.status || 500;
    const mensagem = err.status ? err.message : 'Erro interno do servidor';

    if (req.accepts(['html', 'json']) === 'json') {
        return res.status(status).json({ error: mensagem });
    }
    res.status(status).send(mensagem);
});

syncDatabase(false).then(() => {
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
}).catch((err) => {
    console.error('Falha ao conectar/sincronizar o banco de dados:', err.message);
    process.exit(1);
});

module.exports = app;
