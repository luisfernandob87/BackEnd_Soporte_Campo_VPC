const { Bitacora } = require('../models/bitacora.model')
const { Op } = require('sequelize')

// Helper interno para registrar una entrada en la bitácora (nunca lanza)
const registrarBitacora = async ({ tipo, descripcion, usuario = null }) => {
    try {
        await Bitacora.create({ tipo, descripcion, usuario, fecha: new Date() })
        return true
    } catch (error) {
        console.error('[BITACORA] Error al registrar:', error.message)
        return false
    }
}

const getBitacora = async (req, res) => {
    try {
        const { tipo, usuario, desde, hasta, limite } = req.query
        const where = {}
        if (tipo) where.tipo = tipo
        if (usuario) where.usuario = { [Op.like]: `%${usuario}%` }
        if (desde || hasta) {
            where.fecha = {}
            if (desde) where.fecha[Op.gte] = new Date(desde)
            if (hasta) where.fecha[Op.lte] = new Date(hasta)
        }
        const registros = await Bitacora.findAll({
            where,
            order: [['fecha', 'DESC']],
            limit: limite ? parseInt(limite, 10) : 200
        })
        res.json(registros)
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
}

// Elimina los inicios de sesión con más de 30 días de antigüedad
const deleteBitacoraVencida = async () => {
    const DIAS_RETENCION_LOGIN = 30;
    const limite = new Date();
    limite.setDate(limite.getDate() - DIAS_RETENCION_LOGIN);

    try {
        const eliminados = await Bitacora.destroy({
            where: {
                tipo: 'login',
                fecha: {
                    [Op.lt]: limite
                }
            }
        });
        if (eliminados > 0) {
            console.log(`Se eliminaron ${eliminados} inicios de sesión con más de ${DIAS_RETENCION_LOGIN} días`);
        }
        return eliminados;
    } catch (error) {
        console.error("Error al eliminar logins vencidos:", error.message);
        return 0;
    }
}

const createBitacora = async (req, res) => {
    try {
        const { tipo, descripcion, usuario, fecha } = req.body
        if (!tipo || !descripcion) {
            return res.status(400).json({ message: 'Faltan datos: tipo o descripcion' })
        }
        const registro = await Bitacora.create({
            tipo,
            descripcion,
            usuario: usuario || null,
            fecha: fecha ? new Date(fecha) : new Date()
        })
        res.json(registro)
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
}

module.exports = { registrarBitacora, getBitacora, createBitacora, deleteBitacoraVencida }