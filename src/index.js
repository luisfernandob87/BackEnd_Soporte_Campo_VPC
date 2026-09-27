const { app } = require('./app')
const { sequelize } = require('./database/database')
const { sincronizarEsquema } = require('./database/bootstrap')
const { deleteUbicacionesVencidas } = require('./controllers/ubicaciones.controller')
const { deleteBitacoraVencida } = require('./controllers/bitacora.controller')
const { deleteNotificacionesVencidas } = require('./controllers/notificaciones.controller')
const { inicializarWebSocket } = require('./sockets/notificaciones.socket')
const { iniciarVigilanciaTickets } = require('./services/ticketWatcher.service')

async function main() {
    try {
        // Deja el esquema igual que los modelos: crea las tablas que falten y
        // agrega las columnas que falten. Es idempotente y sólo agrega, nunca
        // borra, así que corre en cada arranque sin riesgo. Reemplaza a los
        // parches manuales por tabla que había acá, que sólo cubrían cuatro
        // tablas y se olvidaban del resto.
        await sincronizarEsquema()
        console.log("Conexion establecida correctamente")

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
        // Se sale con código de error para que Render reinicie el servicio. Antes
        // el proceso se quedaba vivo sin escuchar en $PORT, que dejaba el
        // servicio caído sin que se entendiera la causa.
        console.error("Error de conexion:", error && error.message ? error.message : error);
        if (error && error.original) console.error("Detalle:", error.original);
        process.exit(1);
    }
}

main()