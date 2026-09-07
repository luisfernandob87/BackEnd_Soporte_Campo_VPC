const { Ubicacion } = require('../models/ubicacion.model')
const { Op } = require('sequelize')

// Días de retención del historial de ubicaciones
const DIAS_RETENCION = 30;

const createUbicacion = async (req, res) => {
    const { latitud, longitud } = req.body
    const newUbicacion = await Ubicacion.create({
        latitud,
        longitud
    })

    res.json(newUbicacion)
}

const createHistorialUbicacion = async (req, res) => {
    const { usuario_id, latitud, longitud, accuracy, timestamp } = req.body
    try {
        console.log(`[HISTORIAL] POST /ubicacion/historial recibido: usuario_id=${usuario_id}, lat=${latitud}, lng=${longitud}`)
        if (!usuario_id || !latitud || !longitud) {
            return res.status(400).json({ message: 'Faltan datos: usuario_id, latitud o longitud' })
        }

        const newUbicacion = await Ubicacion.create({
            idUsuario: usuario_id,
            latitud: String(latitud),
            longitud: String(longitud),
            accuracy: accuracy ?? null,
            timestamp: timestamp ? new Date(timestamp) : new Date()
        })
        console.log(`[HISTORIAL] Registro guardado id=${newUbicacion.ubicacion_id}`)
        res.json(newUbicacion)
    } catch (error) {
        console.error(`[HISTORIAL] ERROR al guardar: ${error.message}`)
        return res.status(500).json({ message: error.message })
    }
}

const getHistorialUbicacion = async (req, res) => {
    const { usuario_id } = req.params
    try {
        const ubicaciones = await Ubicacion.findAll({
            where: { idUsuario: usuario_id },
            order: [['timestamp', 'ASC']]
        })
        res.json(ubicaciones)
    } catch (error) {
        return res.status(500).json({ message: error.message })
    }
}

// Elimina los registros de ubicación con más de 30 días de antigüedad
const deleteUbicacionesVencidas = async () => {
    const limite = new Date();
    limite.setDate(limite.getDate() - DIAS_RETENCION);

    try {
        const eliminados = await Ubicacion.destroy({
            where: {
                timestamp: {
                    [Op.lt]: limite
                }
            }
        });
        if (eliminados > 0) {
            console.log(`Se eliminaron ${eliminados} registros de ubicación con más de ${DIAS_RETENCION} días`);
        }
        return eliminados;
    } catch (error) {
        console.error("Error al eliminar ubicaciones vencidas:", error.message);
        return 0;
    }
}

const getUbicacion = async (req, res) => {
    try {
        const ubicacion = await Ubicacion.findAll({
        })
        res.json(ubicacion)
    } catch (error) {
        return res.status(500).json({ message: error.message })
    }
}

// const updateUbicacion = async (req, res) => {
//     const { ubicacion_id } = req.params
//     const updMarcas = await Marcas.findOne({
//         where: { marca_id }
//     })
//     updMarcas.set(req.body)
//     await updMarcas.save()
//     return res.json(updMarcas)
// }

module.exports = { createUbicacion, createHistorialUbicacion, getHistorialUbicacion, deleteUbicacionesVencidas, getUbicacion }