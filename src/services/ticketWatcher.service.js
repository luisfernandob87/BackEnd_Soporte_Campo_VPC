const { Usuario } = require('../models/usuario.model')
const { Notificacion } = require('../models/notificacion.model')
const { TicketVisto } = require('../models/ticket_visto.model')
const {
    estaConectado,
    enviarNotificacion: enviarPorSocket
} = require('../sockets/notificaciones.socket')
const { registrarBitacora } = require('../controllers/bitacora.controller')
const { obtenerTicketsAbiertosDeTecnico } = require('./ticketsHelix.service')

const INTERVALO_DEFAULT_MS = 2 * 60 * 1000 // 2 minutos

let enEjecucion = false

const construirDatosTicket = (entrada, tipo) => ({
    tipo,
    requestId: entrada.id,
    dwpSrid: entrada.dwpSrid,
    incidentNumber: tipo === 'ticket' ? entrada.incidentNumber : entrada.workOrderId,
    cliente: entrada.cliente,
    prioridad: entrada.priority,
    grupo: entrada.grupo,
})

const revisarTicketsNuevos = async () => {
    if (enEjecucion) return
    enEjecucion = true

    try {
        const totalVistos = await TicketVisto.count()
        // Primera ejecución: solo se llena el registro de vistos para no
        // notificar todos los tickets que ya existen.
        const esBaseline = totalVistos === 0

        const tecnicos = await Usuario.findAll({
            where: { rol: 'Técnico', status: 'Activo' }
        })

        for (const tecnico of tecnicos) {
            try {
                const { tickets, workOrders } = await obtenerTicketsAbiertosDeTecnico(tecnico.usuario)

                for (const entrada of [...tickets, ...workOrders]) {
                    const tipo = entrada.type
                    const requestId = entrada.id || ''
                    if (!requestId || requestId === 'Sin ID') continue

                    const yaVisto = await TicketVisto.findOne({
                        where: { tipo, request_id: requestId, usuario_id: tecnico.usuario_id }
                    })
                    if (yaVisto) continue

                    await TicketVisto.create({
                        tipo,
                        request_id: requestId,
                        usuario_id: tecnico.usuario_id
                    })

                    if (esBaseline) continue

                    const datosTicket = construirDatosTicket(entrada, tipo)
                    const mensaje = tipo === 'ticket'
                        ? `Nuevo ticket ${datosTicket.dwpSrid} - ${datosTicket.cliente}`
                        : `Nueva orden de trabajo ${datosTicket.dwpSrid} - ${datosTicket.cliente}`

                    const conectado = estaConectado(tecnico.usuario_id)
                    const notificacion = await Notificacion.create({
                        usuario_id: tecnico.usuario_id,
                        mensaje,
                        estado: conectado ? 'Entregada' : 'Pendiente',
                        datos_ticket: JSON.stringify(datosTicket)
                    })

                    if (conectado) {
                        enviarPorSocket(tecnico.usuario_id, {
                            type: 'notificacion',
                            notificacion_id: notificacion.notificacion_id,
                            mensaje: notificacion.mensaje,
                            fecha: notificacion.fecha,
                            ticket: datosTicket
                        })
                    }

                    registrarBitacora({
                        tipo: 'ticket_nuevo_notificado',
                        descripcion: `Ticket nuevo notificado a ${tecnico.nombreCompleto}: ${datosTicket.dwpSrid}`
                    })
                }
            } catch (error) {
                console.error(`Error al revisar tickets del técnico ${tecnico.usuario}:`, error.message)
            }
        }
    } catch (error) {
        console.error('Error en la revisión de tickets nuevos:', error.message)
    } finally {
        enEjecucion = false
    }
}

const iniciarVigilanciaTickets = () => {
    const intervaloMs = Math.max(
        1000,
        parseInt(process.env.TICKET_POLL_INTERVAL_MS, 10) || INTERVALO_DEFAULT_MS
    )

    // Primera pasada de siembra/revisión al arrancar
    revisarTicketsNuevos()

    return setInterval(revisarTicketsNuevos, intervaloMs)
}

module.exports = { revisarTicketsNuevos, iniciarVigilanciaTickets }