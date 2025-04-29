const { Router } = require('express')
const { createUbicacion, getUbicacion } = require('../controllers/ubicaciones.controller')

const routerUbicacion = Router()

routerUbicacion.post('/ubicacion', createUbicacion)

routerUbicacion.get('/ubicacion', getUbicacion)

module.exports = { routerUbicacion }