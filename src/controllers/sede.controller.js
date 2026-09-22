const {Sede} = require('../models/sede.model'); // Asegúrate de que el modelo esté definido
const { Op, fn, col, where } = require('sequelize');
const { registrarBitacora } = require('./bitacora.controller');

// Validar duplicados por nombre o coordenadas (latitud y longitud)
const validarDuplicados = async (req, res, excluirId = null) => {
    const condiciones = [];

    if (req.body.nombre !== undefined && req.body.nombre !== null && String(req.body.nombre).trim() !== '') {
        condiciones.push({
            nombre: where(
                fn('LOWER', col('nombre')),
                String(req.body.nombre).trim().toLowerCase()
            )
        });
    }

    if (
        req.body.latitud !== undefined && req.body.latitud !== null &&
        req.body.longitud !== undefined && req.body.longitud !== null
    ) {
        condiciones.push({
            latitud: String(req.body.latitud).trim(),
            longitud: String(req.body.longitud).trim()
        });
    }

    if (condiciones.length === 0) return null;

    const filtros = {
        [Op.or]: condiciones
    };
    if (excluirId) {
        filtros.sede_id = { [Op.ne]: excluirId };
    }

    return Sede.findOne({ where: filtros });
};

// Obtener todas las sedes
const getSedes = async (req, res) => {
    try {
        const sedes = await Sede.findAll({
            where:{ status: 'Activo'}
        });
        res.status(200).json(sedes);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener las sedes', error });
    }
};

// Crear una nueva sede
const createSede = async (req, res) => {
    try {
        const duplicado = await validarDuplicados(req, res);
        if (duplicado) {
            return res.status(409).json({
                message: `Ya existe una sede con el nombre "${duplicado.nombre}" o con las mismas coordenadas (${duplicado.latitud}, ${duplicado.longitud}).`
            });
        }

        const newSede = new Sede({
            ...req.body,
            status: 'Activo' // Agregar el status por defecto
        });
        await newSede.save();
        registrarBitacora({
            tipo: 'sede_creada',
            descripcion: `Sede creada: ${newSede.nombre} (${newSede.tipo})`
        });
        res.status(201).json(newSede);
    } catch (error) {
        res.status(500).json({ message: 'Error al crear la sede', error });
    }
};

// Actualizar una sede
const updateSede = async (req, res) => {
    try {
        const { sede_id } = req.params;

        // Buscar la sede por ID
        const sede = await Sede.findOne({
            where: { sede_id }
        });

        // Validar si la sede existe
        if (!sede) {
            return res.status(404).json({ message: 'Sede no encontrada' });
        }

        const duplicado = await validarDuplicados(req, res, sede_id);
        if (duplicado) {
            return res.status(409).json({
                message: `Ya existe otra sede con el nombre "${duplicado.nombre}" o con las mismas coordenadas (${duplicado.latitud}, ${duplicado.longitud}).`
            });
        }

        // Actualizar los campos con los datos enviados
        sede.set(req.body);

        // Guardar los cambios
        await sede.save();
        registrarBitacora({
            tipo: 'sede_editada',
            descripcion: `Sede actualizada: ${sede.nombre} (${sede.tipo})`
        });

        // Enviar la sede actualizada como respuesta
        return res.status(200).json(sede);
    } catch (error) {
        res.status(500).json({ message: 'Error al actualizar la sede', error });
    }
};

// Eliminar una sede
const deleteSede = async (req, res) => {
    try {
        const { sede_id } = req.params;
        const sede = await Sede.findOne({
            where: { sede_id }
        });
        if (!sede) return res.status(404).json({ message: 'Sede no encontrada' });
        const { nombre, tipo } = sede;
        await sede.destroy();
        registrarBitacora({
            tipo: 'sede_eliminada',
            descripcion: `Sede eliminada: ${nombre} (${tipo})`
        });
        res.status(200).json({ message: 'Sede eliminada correctamente' });
    } catch (error) {
        res.status(500).json({ message: 'Error al eliminar la sede', error });
    }
};

module.exports = {
    getSedes,
    createSede,
    updateSede,
    deleteSede,
};