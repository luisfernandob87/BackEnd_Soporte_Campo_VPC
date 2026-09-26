const { getEntradas } = require('./helix.service')

const FILTRO_TICKETS =
    `'Status'!="Resolved" AND 'Status'!="Closed" AND 'Status'!="Cancelled"`
const FILTRO_WORKORDERS =
    `'Status'!="Completed" AND 'Status'!="Rejected" AND 'Status'!="Cancelled"`

// El grupo asignado usa nombres de campo distintos en cada formulario:
// HPD:Help Desk -> "Assigned Group" / "Assigned Group ID"
// WOI:WorkOrder -> ASGRP / ASGRPID
// Ojo: en la orden "Support Group Name" es el grupo de la empresa del registro,
// no el grupo asignado al caso.
const CAMPOS_GRUPO = {
    ticket: { nombre: ['Assigned Group'], id: ['Assigned Group ID'] },
    workOrder: { nombre: ['ASGRP'], id: ['ASGRPID'] },
}

let cacheNombresGrupos = null
let cacheNombresGruposEn = 0
const CACHE_GRUPOS_TTL_MS = 10 * 60 * 1000

// Mapa id -> nombre de todos los grupos de soporte, para resolver el nombre
// del grupo de las órdenes (la WOI:WorkOrder no lo trae, solo su ASGRPID).
const obtenerNombresGrupos = async () => {
    if (cacheNombresGrupos && Date.now() - cacheNombresGruposEn < CACHE_GRUPOS_TTL_MS) {
        return cacheNombresGrupos
    }
    try {
        const entradas = await getEntradas('CTM:Support Group', '')
        const mapa = new Map()
        for (const e of entradas) {
            const v = e.values || {}
            const id = v['Support Group ID']
            const nombre = v['Support Group Name']
            if (id && nombre) mapa.set(String(id), nombre)
        }
        cacheNombresGrupos = mapa
        cacheNombresGruposEn = Date.now()
        return mapa
    } catch (error) {
        console.error('Error al obtener los grupos de soporte:', error)
        return new Map()
    }
}

const getGruposRutaDeTecnico = async (loginId) => {
    try {
        const [asociaciones, nombresGrupos] = await Promise.all([
            getEntradas(
                'CTM:Support Group Association',
                `'Login ID'="${loginId}"`
            ),
            obtenerNombresGrupos(),
        ])
        const gruposRuta = []
        for (const asociacion of asociaciones) {
            const v = asociacion.values || {}
            const id = v['Support Group ID']
            if (!id) continue
            const name = nombresGrupos.get(String(id)) || v['Support Group Name'] || id
            if (name.startsWith('Ruta')) {
                gruposRuta.push(id)
            }
        }
        return gruposRuta
    } catch (error) {
        console.error('Error al obtener grupos de soporte:', error)
        return []
    }
}

const condicionGrupo = (gruposRuta, campo) => {
    if (gruposRuta.length === 0) return null
    if (gruposRuta.length === 1) {
        return `${campo}="${gruposRuta[0]}"`
    }
    return `(${gruposRuta.map((g) => `${campo}="${g}"`).join(' OR ')})`
}

const obtenerNombreCliente = (values) => {
    const primerValor = (keys) =>
        keys.map((k) => values?.[k]).find((v) => v && String(v).trim()) || ''

    const nombre = primerValor([
        'Customer First Name',
        'First Name',
        'Contact First Name'
    ])
    const apellido = primerValor([
        'Customer Last Name',
        'Last Name',
        'Contact Last Name'
    ])
    const nombreCompleto = [nombre, apellido].filter(Boolean).join(' ').trim()
    if (nombreCompleto) return nombreCompleto

    return primerValor(['Customer Name', 'Contact Name']) || 'Sin cliente'
}

const obtenerEmailCliente = (values) => {
    const primerValor = (keys) =>
        keys.map((k) => values?.[k]).find((v) => v && String(v).trim()) || ''
    return (
        primerValor([
            'Internet E-mail',
            'Customer Internet E-mail',
            'Direct Contact Internet E-mail',
            'Customer E-mail',
            'Contact E-mail'
        ]) || ''
    )
}

const obtenerFechaCreacion = (values, esTicket) => {
    const primerValor = (keys) =>
        keys.map((k) => values?.[k]).find((v) => v && String(v).trim()) || ''
    const clave = esTicket ? 'Reported Date' : 'Submit Date'
    return primerValor([clave, 'Reported Date', 'Submit Date']) || ''
}

// Nombre del grupo asignado al caso. Si la entrada no trae el nombre, se
// resuelve el id con el catálogo de CTM:Support Group.
const obtenerNombreGrupo = (values, campos, nombresGrupos) => {
    const nombre = campos.nombre.map((k) => values?.[k]).find((v) => v && String(v).trim())
    if (nombre) return nombre
    const id = campos.id.map((k) => values?.[k]).find((v) => v && String(v).trim())
    if (id && nombresGrupos) {
        const nombreGrupo = nombresGrupos.get(String(id))
        if (nombreGrupo) return nombreGrupo
    }
    return 'Sin grupo'
}

const mapearTicket = (entry, nombresGrupos) => {
    const v = entry.values || {}
    return {
        id: v['Request ID'] || v['Incident Number'] || 'Sin ID',
        dwpSrid: v['DWP_SRID'] || 'Sin ID de petición',
        incidentNumber: v['Incident Number'] || 'Sin número de incidente',
        cliente: obtenerNombreCliente(v),
        email: obtenerEmailCliente(v),
        fechaCreacion: obtenerFechaCreacion(v, true),
        grupo: obtenerNombreGrupo(v, CAMPOS_GRUPO.ticket, nombresGrupos),
        urgency: v['Urgency'] || 'Sin urgencia',
        priority: v['Priority'] || 'Sin prioridad',
        status: v['Status'] || 'Desconocido',
        type: 'ticket',
        tecnico: v['Assignee Login ID'] || v['Assignee'] || '',
    }
}

const mapearWorkOrder = (entry, nombresGrupos) => {
    const v = entry.values || {}
    return {
        id: v['Request ID'] || v['Work Order ID'] || 'Sin ID',
        dwpSrid: v['DWP_SRID'] || v['SRID'] || 'Sin ID de petición',
        workOrderId: v['Work Order ID'] || 'Sin número de orden',
        cliente: obtenerNombreCliente(v),
        email: obtenerEmailCliente(v),
        fechaCreacion: obtenerFechaCreacion(v, false),
        grupo: obtenerNombreGrupo(v, CAMPOS_GRUPO.workOrder, nombresGrupos),
        urgency: v['Urgency'] || 'Sin urgencia',
        priority: v['Priority'] || 'Sin prioridad',
        status: v['Status'] || 'Desconocido',
        type: 'workOrder',
        tecnico: v['ASLOGID'] || v['Assignee Login ID'] || '',
    }
}

const obtenerTicketsAbiertosDeTecnico = async (loginId) => {
    const gruposRuta = await getGruposRutaDeTecnico(loginId)

    let ticketsEntries = []
    let workOrdersEntries = []

    if (gruposRuta.length > 0) {
        const condicionGrupoTickets = condicionGrupo(gruposRuta, "'Assigned Group ID'")
        const condicionGrupoOrdenes = condicionGrupo(gruposRuta, "'ASGRPID'")

        ;[ticketsEntries, workOrdersEntries] = await Promise.all([
            getEntradas(
                'HPD:Help Desk',
                `'Assignee Login ID'="${loginId}" AND ${condicionGrupoTickets} AND ${FILTRO_TICKETS}`
            ).catch(() => []),
            getEntradas(
                'WOI:WorkOrder',
                `'ASLOGID'="${loginId}" AND ${condicionGrupoOrdenes} AND ${FILTRO_WORKORDERS}`
            ).catch(() => []),
        ])
    }

    const nombresGrupos = await obtenerNombresGrupos()

    return {
        tickets: ticketsEntries.map((e) => mapearTicket(e, nombresGrupos)),
        workOrders: workOrdersEntries.map((e) => mapearWorkOrder(e, nombresGrupos)),
    }
}

module.exports = {
    FILTRO_TICKETS,
    FILTRO_WORKORDERS,
    obtenerNombresGrupos,
    obtenerNombreGrupo,
    getGruposRutaDeTecnico,
    condicionGrupo,
    obtenerNombreCliente,
    mapearTicket,
    mapearWorkOrder,
    obtenerTicketsAbiertosDeTecnico,
}