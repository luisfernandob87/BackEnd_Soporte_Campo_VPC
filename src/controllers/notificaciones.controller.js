const { Notificacion } = require('../models/notificacion.model')
const { Usuario } = require('../models/usuario.model')
const { Op } = require('sequelize')
const { estaConectado, enviarNotificacion: enviarPorSocket } = require('../sockets/notificaciones.socket')
const { registrarBitacora } = require('./bitacora.controller')

const DIAS_RETENCION_NOTIFICACIONES = 30

const getNotificaciones = async (req, res) => {
    try {
        const { limite } = req.query
        const limiteFecha = new Date()
        limiteFecha.setDate(limiteFecha.getDate() - DIAS_RETENCION_NOTIFICACIONES)
        const notificaciones = await Notificacion.findAll({
            include: [
                {
                    model: Usuario,
                    attributes: ['nombreCompleto', 'usuario']
                }
            ],
            where: {
                fecha: {
                    [Op.gte]: limiteFecha
                }
            },
            order: [['fecha', 'DESC']],
            limit: limite ? parseInt(limite, 10) : 200
        })
        res.json(notificaciones)
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
}

const getNotificacionesPendientes = async (req, res) => {
    try {
        const { usuario_id } = req.params
        const notificaciones = await Notificacion.findAll({
            where: { usuario_id, estado: 'Pendiente' },
            order: [['fecha', 'ASC']]
        })

        if (notificaciones.length > 0) {
            await Notificacion.update(
                { estado: 'Entregada' },
                { where: { notificacion_id: notificaciones.map((n) => n.notificacion_id) } }
            )
        }

        res.json(notificaciones)
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
}

const getHistorialNotificaciones = async (req, res) => {
    try {
        const { usuario_id } = req.params
        const notificaciones = await Notificacion.findAll({
            where: { usuario_id },
            order: [['fecha', 'DESC']],
            limit: 100
        })
        res.json(notificaciones)
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
}

const enviarNotificacion = async (req, res) => {
    try {
        const { usuario_id, mensaje } = req.body

        if (!usuario_id) {
            return res.status(400).json({ message: 'Debe seleccionar un usuario' })
        }
        if (!mensaje || !String(mensaje).trim()) {
            return res.status(400).json({ message: 'Debe escribir un mensaje' })
        }

        const usuario = await Usuario.findOne({ where: { usuario_id } })
        if (!usuario) {
            return res.status(404).json({ message: 'Usuario no encontrado' })
        }

        const conectado = estaConectado(usuario_id)
        const notificacion = await Notificacion.create({
            usuario_id,
            mensaje: String(mensaje).trim(),
            estado: conectado ? 'Entregada' : 'Pendiente'
        })

        if (conectado) {
            enviarPorSocket(usuario_id, {
                type: 'notificacion',
                notificacion_id: notificacion.notificacion_id,
                mensaje: notificacion.mensaje,
                fecha: notificacion.fecha
            })
        }

        registrarBitacora({
            tipo: 'notificacion_enviada',
            descripcion: `Notificación enviada a ${usuario.nombreCompleto}: ${notificacion.mensaje}`
        })

        res.status(201).json({ ...notificacion.toJSON(), entregada: conectado })
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
}

// Elimina las notificaciones con más de 30 días de antigüedad
const deleteNotificacionesVencidas = async () => {
    const limite = new Date();
    limite.setDate(limite.getDate() - DIAS_RETENCION_NOTIFICACIONES);

    try {
        const eliminados = await Notificacion.destroy({
            where: {
                fecha: {
                    [Op.lt]: limite
                }
            }
        });
        if (eliminados > 0) {
            console.log(`Se eliminaron ${eliminados} notificaciones con más de ${DIAS_RETENCION_NOTIFICACIONES} días`);
        }
        return eliminados;
    } catch (error) {
        console.error("Error al eliminar notificaciones vencidas:", error.message);
        return 0;
    }
}

module.exports = {
    getNotificaciones,
    getNotificacionesPendientes,
    getHistorialNotificaciones,
    enviarNotificacion,
    deleteNotificacionesVencidas
}