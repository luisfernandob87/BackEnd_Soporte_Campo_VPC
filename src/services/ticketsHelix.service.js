const { getEntradas } = require('./helix.service')

const FILTRO_TICKETS =
    `'Status'!="Resolved" AND 'Status'!="Closed" AND 'Status'!="Cancelled"`
const FILTRO_WORKORDERS =
    `'Status'!="Completed" AND 'Status'!="Rejected" AND 'Status'!="Cancelled"`

const getGruposRutaDeTecnico = async (loginId) => {
    try {
        const asociaciones = await getEntradas(
            'CTM:Support Group Association',
            `'Login ID'="${loginId}"`
        )
        const gruposRuta = []
        for (const asociacion of asociaciones) {
            const v = asociacion.values || {}
            const id = v['Support Group ID']
            const tempName = v['Support Group Name'] || id
            if (!id) continue
            let name = tempName
            try {
                const detalles = await getEntradas(
                    'CTM:Support Group',
                    `'Support Group ID'="${id}"`
                )
                if (detalles[0]?.values?.['Support Group Name']) {
                    name = detalles[0].values['Support Group Name']
                }
            } catch (error) {
                console.error(`Error al obtener el grupo ${id}:`, error)
            }
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

const mapearTicket = (entry) => {
    const v = entry.values || {}
    return {
        id: v['Request ID'] || v['Incident Number'] || 'Sin ID',
        dwpSrid: v['DWP_SRID'] || 'Sin ID de petición',
        incidentNumber: v['Incident Number'] || 'Sin número de incidente',
        cliente: obtenerNombreCliente(v),
        grupo: v['Assigned Group'] || v['Assigned Support Group'] || 'Sin grupo',
        urgency: v['Urgency'] || 'Sin urgencia',
        priority: v['Priority'] || 'Sin prioridad',
        status: v['Status'] || 'Desconocido',
        type: 'ticket',
    }
}

const mapearWorkOrder = (entry) => {
    const v = entry.values || {}
    return {
        id: v['Request ID'] || v['Work Order ID'] || 'Sin ID',
        dwpSrid: v['DWP_SRID'] || v['SRID'] || 'Sin ID de petición',
        workOrderId: v['Work Order ID'] || 'Sin número de orden',
        cliente: obtenerNombreCliente(v),
        grupo: v['Assigned Group'] || v['Assigned Support Group'] || 'Sin grupo',
        urgency: v['Urgency'] || 'Sin urgencia',
        priority: v['Priority'] || 'Sin prioridad',
        status: v['Status'] || 'Desconocido',
        type: 'workOrder',
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

    return {
        tickets: ticketsEntries.map(mapearTicket),
        workOrders: workOrdersEntries.map(mapearWorkOrder),
    }
}

module.exports = {
    FILTRO_TICKETS,
    FILTRO_WORKORDERS,
    getGruposRutaDeTecnico,
    condicionGrupo,
    obtenerNombreCliente,
    mapearTicket,
    mapearWorkOrder,
    obtenerTicketsAbiertosDeTecnico,
}