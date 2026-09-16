const { app } = require('./app')
const { sequelize } = require('./database/database')
const { deleteUbicacionesVencidas } = require('./controllers/ubicaciones.controller')
const { deleteBitacoraVencida } = require('./controllers/bitacora.controller')

// Agrega las columnas nuevas de historial a la tabla ubicacions si no existen.
// Versión idempotente para PostgreSQL (Render).
async function asegurarTablaUbicacion() {
    const [columnas] = await sequelize.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'ubicacions'`
    );
    const nombres = columnas.map(c => c.column_name);

    // Normaliza la columna del usuario a "idUsuario" (camelCase), sin importar
    // el estado previo de la BD (Render/PostgreSQL). Si existe la variante en
    // minúsculas (idusuario) migra sus datos a "idUsuario" y la elimina para
    // evitar columnas duplicadas.
    const tieneCamel = nombres.includes('idUsuario');
    const tieneMinus = nombres.includes('idusuario');

    if (!tieneCamel) {
        await sequelize.query(`ALTER TABLE "ubicacions" ADD COLUMN "idUsuario" INTEGER NOT NULL DEFAULT 0`);
        console.log("Columna idUsuario agregada a la tabla ubicacions");
    }
    if (tieneMinus) {
        await sequelize.query(`UPDATE "ubicacions" SET "idUsuario" = idusuario WHERE "idUsuario" IS NULL OR "idUsuario" = 0`);
        await sequelize.query(`ALTER TABLE "ubicacions" DROP COLUMN idusuario`);
        console.log("Columna idusuario migrada y eliminada de la tabla ubicacions");
    }
    if (!nombres.includes('accuracy')) {
        await sequelize.query(`ALTER TABLE "ubicacions" ADD COLUMN accuracy FLOAT`);
        console.log("Columna accuracy agregada a la tabla ubicacions");
    }
    if (!nombres.includes('timestamp')) {
        await sequelize.query(`ALTER TABLE "ubicacions" ADD COLUMN "timestamp" TIMESTAMP DEFAULT NOW()`);
        console.log("Columna timestamp agregada a la tabla ubicacions");
    }

    // Índice para consultas rápidas del historial por usuario (idempotente en PostgreSQL)
    await sequelize.query(`CREATE INDEX IF NOT EXISTS IX_ubicacion_idUsuario ON "ubicacions" ("idUsuario")`);
}


// Elimina las columnas de latitud/longitud de la tabla usuarios (ahora vienen de ubicacions).
// Versión compatible con PostgreSQL (Render).
async function asegurarEliminacionColumnasUsuario() {
    const [columnas] = await sequelize.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'usuarios'`
    );
    const nombres = columnas.map(c => c.column_name);

    if (nombres.includes('latitud') || nombres.includes('longitud')) {
        await sequelize.query(`ALTER TABLE "usuarios" DROP COLUMN IF EXISTS latitud, DROP COLUMN IF EXISTS longitud`);
        console.log("Columnas latitud/longitud eliminadas de la tabla usuarios");
    }
}

async function main() {
    try {
        await sequelize.authenticate()

        await sequelize.sync({ force: false })
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
