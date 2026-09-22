const { Router } = require('express')
const {
    getTecnicos,
    getTicketsDeTecnico,
} = require('../controllers/ticket.controller');

const routerTicket = Router();

// Lista de técnicos activos (para consultar sus tickets)
routerTicket.get('/tickets/tecnicos', getTecnicos);

// Incidentes y órdenes de trabajo asignadas a un técnico
routerTicket.get('/tickets/usuario/:usuario_id', getTicketsDeTecnico);

module.exports = { routerTicket }