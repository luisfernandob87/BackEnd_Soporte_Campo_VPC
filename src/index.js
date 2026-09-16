const { app } = require('./app')
const { sequelize } = require('./database/database')
const { deleteUbicacionesVencidas } = require('./controllers/ubicaciones.controller')
const { deleteBitacoraVencida } = require('./controllers/bitacora.controller')

// Agrega las columnas nuevas de historial a la tabla ubicacions si no existen
async function asegurarTablaUbicacion() {
    const [columnas] = await sequelize.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'ubicacions'`
    );
    const nombres = columnas.map(c => c.COLUMN_NAME);

    if (!nombres.includes('idUsuario')) {
        await sequelize.query(`ALTER TABLE ubicacions ADD idUsuario INT NOT NULL DEFAULT 0`);
        console.log("Columna idUsuario agregada a la tabla ubicacions");
    }
    if (!nombres.includes('accuracy')) {
        await sequelize.query(`ALTER TABLE ubicacions ADD accuracy FLOAT NULL`);
        console.log("Columna accuracy agregada a la tabla ubicacions");
    }
    if (!nombres.includes('timestamp')) {
        await sequelize.query(`ALTER TABLE ubicacions ADD timestamp DATETIME2 NULL DEFAULT GETDATE()`);
        console.log("Columna timestamp agregada a la tabla ubicacions");
    }

    // Índice para consultas rápidas del historial por usuario
    await sequelize.query(`
        IF NOT EXISTS (
            SELECT 1 FROM sys.indexes
            WHERE name = 'IX_ubicacion_idUsuario' AND object_id = OBJECT_ID('ubicacions')
        )
        CREATE INDEX IX_ubicacion_idUsuario ON ubicacions (idUsuario);
    `);
}


// Elimina las columnas de latitud/longitud de la tabla usuarios (ahora vienen de ubicacions)
async function asegurarEliminacionColumnasUsuario() {
    const [columnas] = await sequelize.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'usuarios'`
    );
    const nombres = columnas.map(c => c.COLUMN_NAME);

    if (nombres.includes('latitud') || nombres.includes('longitud')) {
        await sequelize.query(`ALTER TABLE usuarios DROP COLUMN latitud, DROP COLUMN longitud`);
        console.log("Columnas latitud/longitud eliminadas de la tabla usuarios");
    }
}

async function main() {
    try {
        await sequelize.authenticate()

        await sequelize.sync({ force: true })
        console.log("Conection succesfully");

        // Asegurar las columnas de historial en la tabla ubicacion
        await asegurarTablaUbicacion();

        // Eliminar latitud/longitud de la tabla usuarios
        await asegurarEliminacionColumnasUsuario();

        // Limpiar el historial de ubicaciones con más de 30 días al arrancar
        await deleteUbicacionesVencidas();

        // Limpiar los inicios de sesión con más de 30 días al arrancar
        await deleteBitacoraVencida();

        // Limpiar el historial de ubicaciones vencidas diariamente
        setInterval(async () => {
            await deleteUbicacionesVencidas();
            await deleteBitacoraVencida();
        }, 24 * 60 * 60 * 1000);

        const PORT = process.env.PORT || 4000;

        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    } catch (error) {
        console.error("Error de conexion" + error)
    }
}

main()
