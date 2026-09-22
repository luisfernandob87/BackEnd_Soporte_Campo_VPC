const { Router } = require('express')
const {
    getSedes,
    createSede,
    updateSede,
    deleteSede,
} = require('../controllers/sede.controller');

const routerSede = Router();

// Ruta para obtener todas las sedes
routerSede.get('/sedes', getSedes);

// Ruta para crear una nueva sede
routerSede.post('/sede', createSede);

// Ruta para actualizar una sede por ID
routerSede.patch('/sede/:sede_id', updateSede);

// Ruta para eliminar una sede por ID
routerSede.delete('/sede/:sede_id', deleteSede);

module.exports = {routerSede};