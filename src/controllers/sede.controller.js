const {Sede} = require('../models/sede.model'); // Asegúrate de que el modelo esté definido

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
        const newSede = new Sede({
            ...req.body,
            status: 'Activo' // Agregar el status por defecto
        });
        await newSede.save();
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

        // Actualizar los campos con los datos enviados
        sede.set(req.body);

        // Guardar los cambios
        await sede.save();

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
        const deletedSede = await Sede.findByIdAndDelete(sede_id);
        if (!deletedSede) return res.status(404).json({ message: 'Sede no encontrada' });
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