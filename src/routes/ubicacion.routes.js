const { Router } = require('express')
const { createUbicacion, createHistorialUbicacion, getHistorialUbicacion, getUbicacion } = require('../controllers/ubicaciones.controller')

const routerUbicacion = Router()

routerUbicacion.post('/ubicacion', createUbicacion)

routerUbicacion.get('/ubicacion', getUbicacion)

routerUbicacion.post('/ubicacion/historial', createHistorialUbicacion)

routerUbicacion.get('/usuario/:usuario_id/historial', getHistorialUbicacion)

module.exports = { routerUbicacion }