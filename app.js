require('dotenv').config();

const path = require('path');
const express = require('express');
const methodOverride = require('method-override');
const expressLayouts = require('express-ejs-layouts');
const session = require('express-session');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const { sessionPool } = require('./config/db');

const indexRoutes = require('./routes/indexRoutes');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const produtoRoutes = require('./routes/produtoSequelizeRoutes');
const categoriaRoutes = require('./routes/categoriaRoutes');
const clienteRoutes = require('./routes/clienteRoutes');
const pedidoRoutes = require('./routes/pedidoRoutes');

const { requireAuth, requireRole, carregarUsuario } = require('./middleware/auth');
const { csrfSetup, verifyCsrf } = require('./middleware/csrf');
const { requestId } = require('./middleware/requestId');
const { healthCheck } = require('./middleware/health');

// Carrega models/index.js para registrar as associações do Sequelize antes de
// qualquer controller — sem isso, sequelize.include() falha em runtime.
require('./models');

const app = express();

// Necessário atrás de proxy (nginx etc.) para IP real do cliente:
// rate limiting por IP e cookies secure funcionam corretamente.
// Só habilite se existir de fato um proxy reverso na frente (ver .env.example).
if (process.env.TRUST_PROXY === 'true' || process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
}

if (!process.env.SESSION_SECRET) {
    if (process.env.NODE_ENV === 'production') {
        throw new Error('SESSION_SECRET não definido. Configure-o no arquivo .env antes de rodar em produção.');
    }
    // Em desenvolvimento, gera um segredo aleatório (não persiste entre restarts)
    process.env.SESSION_SECRET = require('crypto').randomBytes(32).toString('hex');
    console.warn('AVISO: SESSION_SECRET gerado aleatoriamente para desenvolvimento. Configure-o no .env.');
}

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);

app.use(requestId);

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            // views/layout.ejs carrega Bootstrap, jQuery e Popper de
            // cdn.jsdelivr.net, todos com integrity=SRI. Antes eram três
            // origens distintas (jsdelivr, code.jquery.com, maxcdn); consolidar
            // deixa a CSP com uma só e o SRI passa a ser a garantia real de que
            // o recurso não foi trocado no caminho. A versão do jQuery subiu
            // 3.5.1 -> 3.7.1 (o build slim do 3.5.1 no code.jquery.com não é
            // mais servido de forma estável). maxcdn.bootstrapcdn.com está
            // fora: se alguém voltar a usá-lo, a CSP bloqueia em vez de abrir
            // uma origem sem SRI.
            styleSrc: ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net'],
            scriptSrc: ["'self'", 'cdn.jsdelivr.net'],
            imgSrc: ["'self'", 'data:'],
        },
    },
}));

// CORS: same-origin por padrão. Sem CORS_ORIGINS configurado, nenhuma origem
// externa é atendida. Com origens listadas, apenas elas recebem headers CORS.
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

const corsMiddleware = (req, res, next) => {
    if (ALLOWED_ORIGINS.length === 0) {
        // Sem origens configuradas: same-origin only (padrão seguro)
        return next();
    }

    // A resposta varia por Origin; sem isso um cache intermediário poderia
    // servir a resposta de uma origem autorizada para outra.
    res.vary('Origin');

    const origin = req.get('Origin');
    if (origin && ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        return next();
    }
    if (origin) {
        return res.status(403).json({ error: 'Origem não permitida' });
    }
    // Requisições sem Origin (navegação, curl, mesma origem) seguem normais
    next();
};

app.use(corsMiddleware);

app.use(rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: Number(process.env.RATE_LIMIT_MAX) || 100,
    standardHeaders: true,
    legacyHeaders: false,
}));

app.use(express.json({ limit: '200kb' }));
app.use(express.urlencoded({ extended: true, limit: '200kb' }));
app.use(methodOverride('_method'));

// Sessões persistidas no PostgreSQL (sobrevive a restarts e não vaza memória).
// Reutiliza o mesmo pool do Sequelize em vez de abrir um segundo.
app.use(session({
    secret: process.env.SESSION_SECRET,
    name: 'sessionId',
    resave: false,
    saveUninitialized: false,
    store: new (require('connect-pg-simple')(session))({
        pool: sessionPool,
        createTableIfMissing: true,
        ttl: 2 * 60 * 60, // 2 horas, em segundos
    }),
    cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 2 * 60 * 60 * 1000, // 2 horas
    },
}));

// Proteção CSRF para todas as rotas que alteram estado
app.use(verifyCsrf);

// Expõe o token às views SEM gravar sessão de visitantes anônimos;
// a gravação ocorre apenas no formulário de login e nas áreas protegidas
app.use((req, res, next) => {
    res.locals.csrfToken = req.session.csrfToken;
    next();
});

// Disponibiliza o usuário logado para todas as views.
// Roda depois de carregarUsuario, então role/username vêm do banco e não da
// fotografia congelada no momento do login.
app.use(carregarUsuario);
app.use((req, res, next) => {
    res.locals.currentUser = req.session.userId
        ? { id: req.session.userId, username: req.session.username, role: req.session.role }
        : null;
    next();
});

// Sonda de saúde — pública por definição, não exige sessão
app.get('/health', healthCheck);

// Rotas públicas
// app.locals (e não res.locals) porque é o escopo compartilhado que o Express
// mescla automaticamente nas opções de res.render. Assim as views de pedidos
// formatam moeda, data e status sem repetir a lógica em cada template.
app.locals.formatadores = require('./utils/formatar');

app.use('/', authRoutes);
app.use('/', indexRoutes);

// Rotas protegidas (exigem autenticação)
// csrfSetup roda só aqui: garante token para os formulários sem criar
// sessão em visitas anônimas
app.use('/produtos', requireAuth, csrfSetup, produtoRoutes);
app.use('/categorias', requireAuth, csrfSetup, categoriaRoutes);
app.use('/clientes', requireAuth, csrfSetup, clienteRoutes);
app.use('/pedidos', requireAuth, csrfSetup, pedidoRoutes);

// Gestão de usuários é exclusiva de administradores
app.use('/users', requireAuth, requireRole('admin'), csrfSetup, userRoutes);

const { ehJson } = require('./utils/responder');

// 404 - rota não encontrada
app.use((req, res) => {
    if (ehJson(req)) {
        return res.status(404).json({ error: 'Rota não encontrada' });
    }
    res.status(404).render('404');
});

// Tratamento central de erros (não vaza detalhes internos ao cliente)
// next é obrigatório para o Express reconhecer este como errorHandler (4 args);
// a regra no-unused-vars já ignora args por nome em ^_|^next$.
app.use((err, req, res, next) => {
    console.error(`[Erro][${req.id}]`, err); // log completo (com stack) apenas no servidor

    // Se a resposta já começou a sair (stream, redirect com dados, etc.),
    // tentar renderizar aqui estoura "Cannot set headers after they are sent".
    // O next() entrega o erro ao handler final do Express, que só fecha a
    // conexão.
    if (res.headersSent) {
        return next(err);
    }

    const status = err.status || 500;
    const mensagem = err.status ? err.message : 'Erro interno do servidor';

    if (ehJson(req)) {
        // O id vai junto para o cliente poder citar o log exato sem precisar
        // de acesso ao servidor.
        const corpo = { error: mensagem };
        if (status >= 500) corpo.requestId = req.id;
        return res.status(status).json(corpo);
    }

    res.status(status).render(status === 404 ? '404' : '500', {
        erro: mensagem,
        requestId: req.id,
    });
});

module.exports = app;
