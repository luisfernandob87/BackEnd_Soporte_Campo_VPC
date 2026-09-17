const { Usuario } = require('../models/usuario.model')
const { getEntradas } = require('../services/helix.service')

const FILTRO_TICKETS =
    `'Status'!="Resolved" AND 'Status'!="Closed" AND 'Status'!="Cancelled"`
const FILTRO_WORKORDERS =
    `'Status'!="Completed" AND 'Status'!="Rejected" AND 'Status'!="Cancelled"`

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

        const [ticketsEntries, workOrdersEntries] = await Promise.all([
            getEntradas(
                'HPD:Help Desk',
                `'Assignee Login ID'="${loginId}" AND ${FILTRO_TICKETS}`
            ).catch(() => []),
            getEntradas(
                'WOI:WorkOrder',
                `'ASLOGID'="${loginId}" AND ${FILTRO_WORKORDERS}`
            ).catch(() => []),
        ])

        const tickets = ticketsEntries.map((entry) => {
            const v = entry.values || {}
            return {
                id: v['Request ID'] || 'Sin ID',
                dwpSrid: v['DWP_SRID'] || 'Sin ID de petición',
                incidentNumber: v['Incident Number'] || 'Sin número de incidente',
                urgency: v['Urgency'] || 'Sin urgencia',
                priority: v['Priority'] || 'Sin prioridad',
                status: v['Status'] || 'Desconocido',
                type: 'ticket',
            }
        })

        const workOrders = workOrdersEntries.map((entry) => {
            const v = entry.values || {}
            return {
                id: v['Request ID'] || 'Sin ID',
                dwpSrid: v['DWP_SRID'] || v['SRID'] || 'Sin ID de petición',
                workOrderId: v['Work Order ID'] || 'Sin número de orden',
                urgency: v['Urgency'] || 'Sin urgencia',
                priority: v['Priority'] || 'Sin prioridad',
                status: v['Status'] || 'Desconocido',
                type: 'workOrder',
            }
        })

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