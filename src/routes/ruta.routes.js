const { Router } = require('express')
const {
    getRutas,
    getRuta,
    createRuta,
    updateRuta,
    deleteRuta,
} = require('../controllers/ruta.controller');

const routerRuta = Router();

// Ruta para obtener todas las rutas
routerRuta.get('/rutas', getRutas);

// Ruta para obtener una ruta por ID con sus sedes en orden
routerRuta.get('/ruta/:ruta_id', getRuta);

// Ruta para crear una nueva ruta
routerRuta.post('/ruta', createRuta);

// Ruta para actualizar una ruta (campos y orden de sedes)
routerRuta.put('/ruta/:ruta_id', updateRuta);

// Ruta para eliminar una ruta
routerRuta.delete('/ruta/:ruta_id', deleteRuta);

module.exports = { routerRuta }