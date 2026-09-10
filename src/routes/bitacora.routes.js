const { Router } = require('express')
const { getBitacora, createBitacora } = require('../controllers/bitacora.controller')

const routerBitacora = Router()

routerBitacora.get('/bitacora', getBitacora)

routerBitacora.post('/bitacora', createBitacora)

module.exports = { routerBitacora }