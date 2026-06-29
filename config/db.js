const { Sequelize } = require('sequelize');
const dotenv = require('dotenv');

dotenv.config();

const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
        host: process.env.DB_HOST,
        dialect: 'postgres',
        port: process.env.DB_PORT || 5432,
        logging: false, // Mude para console.log para debug
    }
);

sequelize.authenticate()
    .then(() => {
        console.log('Connected to the PostgreSQL database with Sequelize.');
    })
    .catch((err) => {
        console.error('Error connecting to the database:', err);
    });

module.exports = sequelize;

