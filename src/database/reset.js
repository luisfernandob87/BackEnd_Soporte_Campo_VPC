// Recrea el esquema desde cero, BORRANDO todas las tablas. Sólo para demos.
// Está barricado: sin DB_ALLOW_DROP=true en el entorno no hace nada, para que
// nadie borre la base por un comando sin querer.
require('dotenv').config();

if (process.env.DB_ALLOW_DROP !== 'true') {
    console.error('[db] reset cancelado: este comando borra todas las tablas y datos.');
    console.error('[db] para correrlo igual, define DB_ALLOW_DROP=true en el entorno.');
    process.exit(1);
}

const { sequelize } = require('./database');
const { cargarModelos } = require('./bootstrap');

(async () => {
    try {
        cargarModelos();
        await sequelize.authenticate();
        console.log('[db] BORRANDO todas las tablas y recreándolas desde los modelos...');
        await sequelize.sync({ force: true });
        console.log('[db] esquema recreado');
        await sequelize.close();
        process.exit(0);
    } catch (error) {
        console.error('[db] falló el reset:', error.message);
        try {
            await sequelize.close();
        } catch (_) {
            // nada que hacer al cerrar
        }
        process.exit(1);
    }
})();
