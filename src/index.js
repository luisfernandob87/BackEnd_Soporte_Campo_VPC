const { app } = require('./app')
const { sequelize } = require('./database/database')
const { deleteUbicacionesVencidas } = require('./controllers/ubicaciones.controller')
const { deleteBitacoraVencida } = require('./controllers/bitacora.controller')
const { deleteNotificacionesVencidas } = require('./controllers/notificaciones.controller')
const { inicializarWebSocket } = require('./sockets/notificaciones.socket')
const { iniciarVigilanciaTickets } = require('./services/ticketWatcher.service')

// Agrega las columnas nuevas de historial a la tabla ubicacions si no existen.
// Versión idempotente para PostgreSQL (Render).
async function asegurarTablaUbicacion() {
    const [columnas] = await sequelize.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'ubicacions'`
    );
    const nombres = columnas.map(c => c.column_name);

    // Normaliza la columna del usuario a "idUsuario" (camelCase), sin importar
    // el estado previo de la BD (Render/PostgreSQL). Si existe la variante en
    // minúsculas (idusuario) migra sus datos a "idUsuario" y la elimina.
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
        const tipoTimestamp = sequelize.getDialect() === 'mssql'
            ? `DATETIME DEFAULT GETDATE()`
            : `TIMESTAMP DEFAULT NOW()`;
        await sequelize.query(`ALTER TABLE "ubicacions" ADD COLUMN "timestamp" ${tipoTimestamp}`);
        console.log("Columna timestamp agregada a la tabla ubicacions");
    }

    // Índice para consultas rápidas del historial por usuario (idempotente en ambos motores)
    if (sequelize.getDialect() === 'mssql') {
        await sequelize.query(
            `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ubicacion_idUsuario' AND object_id = OBJECT_ID('dbo.ubicacions')) ` +
            `CREATE NONCLUSTERED INDEX IX_ubicacion_idUsuario ON "dbo"."ubicacions" ("idUsuario")`
        );
    } else {
        await sequelize.query(`CREATE INDEX IF NOT EXISTS IX_ubicacion_idUsuario ON "ubicacions" ("idUsuario")`);
    }
}

// Elimina las columnas de latitud/longitud de la tabla usuarios.
// Versión compatible con PostgreSQL (Render).
async function asegurarEliminacionColumnasUsuario() {
    const [columnas] = await sequelize.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'usuarios'`
    );
    const nombres = columnas.map(c => c.column_name);

    if (nombres.includes('latitud') || nombres.includes('longitud')) {
        const dropColumnas = sequelize.getDialect() === 'mssql'
            ? `DROP COLUMN latitud, longitud`
            : `DROP COLUMN IF EXISTS latitud, DROP COLUMN IF EXISTS longitud`;
        await sequelize.query(`ALTER TABLE "usuarios" ${dropColumnas}`);
        console.log("Columnas latitud/longitud eliminadas de la tabla usuarios");
    }
}

// Agrega la columna datos_ticket (JSON TICKET metadata) a la tabla notificacions.
// Versión idempotente para PostgreSQL (Render).
async function asegurarColumnasNotificacion() {
    const [columnas] = await sequelize.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'notificacions'`
    );
    const nombres = columnas.map(c => c.column_name);

    if (!nombres.includes('datos_ticket')) {
        const tipoTexto = sequelize.getDialect() === 'mssql' ? `NVARCHAR(MAX)` : `TEXT`;
        await sequelize.query(`ALTER TABLE "notificacions" ADD COLUMN "datos_ticket" ${tipoTexto}`);
        console.log("Columna datos_ticket agregada a la tabla notificacions");
    }
}

// Agrega la columna orden_bloqueado a la tabla ruta si no existe.
// Valida que el orden fijado por el técnico no sea rehecho por la ruta automática.
async function asegurarColumnasRuta() {
    const [columnas] = await sequelize.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'ruta'`
    );
    const nombres = columnas.map(c => c.column_name);

    if (!nombres.includes('orden_bloqueado')) {
        const tipoBool = sequelize.getDialect() === 'mssql' ? `BIT DEFAULT 0` : `BOOLEAN DEFAULT FALSE`;
        await sequelize.query(`ALTER TABLE "ruta" ADD COLUMN "orden_bloqueado" ${tipoBool}`);
        console.log("Columna orden_bloqueado agregada a la tabla ruta");
    }
}

async function main() {
    try {
        await sequelize.authenticate()

        await sequelize.sync({ force: false })
        console.log("Conection succesfully");

        await asegurarTablaUbicacion();
        await asegurarEliminacionColumnasUsuario();
        await asegurarColumnasNotificacion();
        await asegurarColumnasRuta();
        await deleteUbicacionesVencidas();
        await deleteBitacoraVencida();
        await deleteNotificacionesVencidas();

        setInterval(async () => {
            await deleteUbicacionesVencidas();
            await deleteBitacoraVencida();
            await deleteNotificacionesVencidas();
        }, 24 * 60 * 60 * 1000);

        const PORT = process.env.PORT || 4000;

        const server = app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });

        inicializarWebSocket(server);
        iniciarVigilanciaTickets();
    } catch (error) {
        console.error("Error de conexion" + error)
    }
}

main()