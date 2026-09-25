const { Router } = require('express')
const {
    getTicketsGeoreferencia,
    asignarGeoreferencia,
    quitarGeoreferencia,
} = require('../controllers/georeferencia.controller')

const routerGeoreferencia = Router()

// Visor de georreferenciación: tickets/órdenes abiertos de todos los grupos "Ruta"
routerGeoreferencia.get('/georeferencia/tickets', getTicketsGeoreferencia)

// Asigna manualmente la sede/agencia de un ticket
routerGeoreferencia.put('/georeferencia/ticket', asignarGeoreferencia)

// Quita la georreferenciación manual (tipo + request_id por query string)
routerGeoreferencia.delete('/georeferencia/ticket', quitarGeoreferencia)

module.exports = { routerGeoreferencia }