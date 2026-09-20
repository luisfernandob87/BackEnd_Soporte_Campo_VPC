const { Router } = require('express')
const {
    getNotificaciones,
    getNotificacionesPendientes,
    getHistorialNotificaciones,
    enviarNotificacion
} = require('../controllers/notificaciones.controller')

const routerNotificacion = Router()

// Historial de notificaciones (portal)
routerNotificacion.get('/notificaciones', getNotificaciones)

// Pendientes de un usuario (app móvil al conectar)
routerNotificacion.get('/notificaciones/pendientes/:usuario_id', getNotificacionesPendientes)

// Historial de notificaciones de un usuario (app móvil)
routerNotificacion.get('/notificaciones/historial/:usuario_id', getHistorialNotificaciones)

// Enviar una notificación a un usuario (portal)
routerNotificacion.post('/notificacion', enviarNotificacion)

module.exports = { routerNotificacion }