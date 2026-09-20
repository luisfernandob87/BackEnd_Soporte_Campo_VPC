const { Usuario } = require('../models/usuario.model')
const {
    obtenerTicketsAbiertosDeTecnico,
} = require('../services/ticketsHelix.service')

const getTecnicos = async (req, res) => {
    try {
        const tecnicos = await Usuario.findAll({
            where: { rol: 'Técnico', status: 'Activo' },
            attributes: ['usuario_id', 'usuario', 'nombreCompleto'],
            order: [['nombreCompleto', 'ASC']],
        })
        res.json(tecnicos)
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
}

const getTicketsDeTecnico = async (req, res) => {
    const { usuario_id } = req.params
    try {
        const tecnico = await Usuario.findOne({
            where: { usuario_id },
            attributes: ['usuario_id', 'usuario', 'nombreCompleto', 'rol'],
        })
        if (!tecnico) {
            return res.status(404).json({ message: 'Técnico no encontrado' })
        }

        const loginId = tecnico.usuario

        const resultado = await obtenerTicketsAbiertosDeTecnico(loginId)
        const { tickets, workOrders } = resultado

        res.json({
            tecnico: {
                usuario_id: tecnico.usuario_id,
                usuario: tecnico.usuario,
                nombreCompleto: tecnico.nombreCompleto,
            },
            tickets,
            workOrders,
        })
    } catch (error) {
        console.error('Error al obtener tickets de BMC:', error.response?.data || error.message)
        res.status(502).json({ message: 'No se pudieron obtener los tickets del técnico' })
    }
}

module.exports = { getTecnicos, getTicketsDeTecnico }