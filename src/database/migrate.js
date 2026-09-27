// Ejecuta la sincronización del esquema a mano: npm run db:migrate
// Útil desde el shell de Render, aunque el backend también lo hace al arrancar.
require('dotenv').config();
const { sequelize } = require('./database');
const { sincronizarEsquema } = require('./bootstrap');

(async () => {
    try {
        await sincronizarEsquema();
        await sequelize.close();
        process.exit(0);
    } catch (error) {
        console.error('[db] falló la sincronización:', error.message);
        try {
            await sequelize.close();
        } catch (_) {
            // nada que hacer al cerrar
        }
        process.exit(1);
    }
})();
