const { getEntradas } = require('./helix.service')
const { Sede } = require('../models/sede.model')
const { TicketGeoref } = require('../models/ticket_georef.model')
const {
    FILTRO_TICKETS,
    FILTRO_WORKORDERS,
    condicionGrupo,
    mapearTicket,
    mapearWorkOrder,
} = require('./ticketsHelix.service')
const {
    construirMapaCorreoSede,
    normalizarCorreos,
} = require('./rutaAutomatica.service')
const { registrarBitacora } = require('../controllers/bitacora.controller')

let cacheGrupos = null
let cacheGruposEn = 0
const CACHE_TTL_MS = 10 * 60 * 1000

// Grupos cuyo nombre inicia con "Ruta" (los que se resuelven en el mapa).
const obtenerGruposRuta = async () => {
    if (cacheGrupos && Date.now() - cacheGruposEn < CACHE_TTL_MS) return cacheGrupos
    try {
        let entradas = await getEntradas(
            'CTM:Support Group',
            `'Support Group Name' LIKE "Ruta*"`
        )
        if (!entradas || entradas.length === 0) {
            entradas = await getEntradas('CTM:Support Group', '')
        }
        const grupos = []
        const vistos = new Set()
        for (const e of entradas) {
            const v = e.values || {}
            const nombre = v['Support Group Name'] || ''
            const id = v['Support Group ID']
            if (String(nombre).startsWith('Ruta') && id && !vistos.has(id)) {
                vistos.add(id)
                grupos.push({ id, nombre })
            }
        }
        cacheGrupos = grupos
        cacheGruposEn = Date.now()
        return grupos
    } catch (error) {
        console.error('Error al obtener grupos Ruta:', error)
        return []
    }
}

// Sede ubicada automáticamente por el correo del cliente (misma lógica de la ruta del día).
const obtenerSedeAutomatica = (entrada, mapaCorreoSede) => {
    for (const correo of normalizarCorreos(entrada.email)) {
        const sede = mapaCorreoSede.get(correo)
        if (sede) return sede
    }
    return null
}

// Tickets y órdenes abiertos de todos los grupos "Ruta", con su estado de
// georreferenciación (automática por correo o manual desde el visor).
// Si se pasa `tecnico`, solo devuelve los asignados a ese login de Remedy.
const obtenerTicketsGeoreferencia = async (tecnico = '') => {
    const [sedes, gruposRuta, manuales] = await Promise.all([
        Sede.findAll(),
        obtenerGruposRuta(),
        TicketGeoref.findAll(),
    ])
    const mapaCorreoSede = construirMapaCorreoSede(sedes)
    const sedesPorId = new Map(sedes.map((s) => [s.sede_id, s]))

    let ticketsEntries = []
    let workOrdersEntries = []

    const idsGrupos = gruposRuta.map((g) => g.id)
    if (idsGrupos.length > 0) {
        const condTickets = condicionGrupo(idsGrupos, "'Assigned Group ID'")
        const condOrdenes = condicionGrupo(idsGrupos, "'ASGRPID'")
        ;[ticketsEntries, workOrdersEntries] = await Promise.all([
            getEntradas(
                'HPD:Help Desk',
                `${condTickets} AND ${FILTRO_TICKETS}`
            ).catch(() => []),
            getEntradas(
                'WOI:WorkOrder',
                `${condOrdenes} AND ${FILTRO_WORKORDERS}`
            ).catch(() => []),
        ])
    }

    const manualPorPar = new Map()
    for (const m of manuales) manualPorPar.set(`${m.tipo}|${m.request_id}`, m)

    const entradas = [
        ...ticketsEntries.map(mapearTicket),
        ...workOrdersEntries.map(mapearWorkOrder),
    ]

    let tickets = entradas.map((e) => {
        const manual = manualPorPar.get(`${e.type}|${e.id}`)
        const sedeManual = manual ? sedesPorId.get(manual.sede_id) : null
        const sedeAuto = obtenerSedeAutomatica(e, mapaCorreoSede)
        const sede = sedeManual || sedeAuto
        const fuente = sedeManual ? 'manual' : sedeAuto ? 'automatica' : 'sin georreferenciar'
        return {
            tipo: e.type,
            requestId: e.id,
            dwpSrid: e.dwpSrid,
            cliente: e.cliente,
            email: e.email,
            grupo: e.grupo,
            prioridad: e.priority,
            status: e.status,
            fechaCreacion: e.fechaCreacion,
            tecnico: e.tecnico || '',
            sede: sede || null,
            fuente,
            georreferenciado: Boolean(sede),
        }
    })

    if (tecnico) {
        const q = String(tecnico).trim().toLowerCase()
        tickets = tickets.filter(
            (t) => t.tecnico && t.tecnico.toLowerCase() === q
        )
    }

    return {
        grupos: gruposRuta,
        total: tickets.length,
        tickets,
    }
}

// Asigna manualmente la sede/agencia de un ticket. Devuelve null o mensaje de error.
const esSedeSuper24 = (sede) => sede && String(sede.tipo).toLowerCase() === 'super 24'

const obtenerSedeActualDeTicket = async (tipo, request_id) => {
    const existente = await TicketGeoref.findOne({
        where: { tipo, request_id: String(request_id) },
    })
    if (!existente) return null
    return Sede.findByPk(existente.sede_id)
}

const asignarGeoreferencia = async ({ tipo, request_id, sede_id, usuario_id = null } = {}) => {
    if (!tipo || !request_id) return 'Faltan el tipo y el ID de petición'
    if (!sede_id) return 'Debe seleccionar una sede o agencia'

    const id = Number(sede_id)
    const sede = await Sede.findByPk(id)
    if (!sede) return 'La sede seleccionada no existe'
    if (esSedeSuper24(sede)) return 'La sede Super 24 no se puede asignar ni modificar manualmente'

    const sedeActual = await obtenerSedeActualDeTicket(tipo, request_id)
    if (esSedeSuper24(sedeActual)) return 'El ticket tiene una sede Super 24 fija y no se puede cambiar'

    const [georef] = await TicketGeoref.findOrCreate({
        where: { tipo, request_id: String(request_id) },
        defaults: { sede_id: id, usuario_id: usuario_id || null, fecha: new Date() },
    })
    await TicketGeoref.update(
        { sede_id: id, usuario_id: usuario_id || null, fecha: new Date() },
        { where: { ticket_georef_id: georef.ticket_georef_id } }
    )

    registrarBitacora({
        tipo: 'georeferencia',
        descripcion: `Ticket ${tipo} ${request_id} georreferenciado a ${sede.nombre}`,
        usuario: usuario_id ? `Usuario ${usuario_id}` : null,
    })

    return null
}

// Quita la georreferenciación manual de un ticket. Devuelve null o mensaje de error.
const quitarGeoreferencia = async ({ tipo, request_id } = {}) => {
    if (!tipo || !request_id) return 'Faltan el tipo y el ID de petición'
    const sedeActual = await obtenerSedeActualDeTicket(tipo, request_id)
    if (esSedeSuper24(sedeActual)) return 'El ticket tiene una sede Super 24 fija y no se puede quitar'
    const eliminados = await TicketGeoref.destroy({
        where: { tipo, request_id: String(request_id) },
    })
    registrarBitacora({
        tipo: 'georeferencia',
        descripcion: `Georreferenciación manual quitada del ticket ${tipo} ${request_id}`,
    })
    if (eliminados === 0) return 'No existía una georreferenciación manual para ese ticket'
    return null
}

module.exports = {
    obtenerGruposRuta,
    obtenerTicketsGeoreferencia,
    asignarGeoreferencia,
    quitarGeoreferencia,
}