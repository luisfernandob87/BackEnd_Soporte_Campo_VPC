const { sequelize } = require('../database/database')
const { Op } = require('sequelize')
const { Ruta } = require('../models/ruta.model')
const { RutaSede } = require('../models/ruta_sede.model')
const { Sede } = require('../models/sede.model')
const { TicketGeoref } = require('../models/ticket_georef.model')
const { registrarBitacora } = require('../controllers/bitacora.controller')

const normalizarCorreos = (valor) => {
    if (!valor || typeof valor !== 'string') return []
    return valor
        .split(/[;,]/)
        .map((c) => c.trim().toLowerCase())
        .filter((c) => c.length > 0)
}

const fechaHoyLocal = () => {
    const d = new Date()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${d.getFullYear()}-${mm}-${dd}`
}

const msDeFecha = (valor) => {
    if (!valor) return null
    const ts = Date.parse(String(valor))
    return isNaN(ts) ? null : ts
}

// Mapa correo normalizado → sede (soporta correos múltiples por sede)
const construirMapaCorreoSede = (sedes) => {
    const mapa = new Map()
    for (const sede of sedes) {
        if (!sede.correo) continue
        for (const correo of normalizarCorreos(sede.correo)) {
            if (!mapa.has(correo)) {
                mapa.set(correo, sede)
            }
        }
    }
    return mapa
}

// Calcula las sedes a visitar del día para un técnico y las ordena poniendo
// primero la del ticket más antiguo (fecha de creación mínima por sede).
const calcularSedesDelDia = (entradas, mapaCorreoSede) => {
    const porSede = new Map() // sede_id → { sede, fechaMinMs }

    const registrar = (sede, fechaCreacion) => {
        const ms = msDeFecha(fechaCreacion)
        const previo = porSede.get(sede.sede_id)
        if (!previo) {
            porSede.set(sede.sede_id, { sede, fechaMinMs: ms })
        } else if (ms !== null && (previo.fechaMinMs === null || ms < previo.fechaMinMs)) {
            previo.fechaMinMs = ms
        }
    }

    for (const entrada of entradas) {
        if (entrada.sedeManual) {
            registrar(entrada.sedeManual, entrada.fechaCreacion)
            continue
        }
        for (const correo of normalizarCorreos(entrada.email)) {
            const sede = mapaCorreoSede.get(correo)
            if (!sede) continue
            registrar(sede, entrada.fechaCreacion)
        }
    }

    return [...porSede.values()]
        .sort((a, b) => {
            if (a.fechaMinMs === null && b.fechaMinMs === null) {
                return String(a.sede.nombre || '').localeCompare(String(b.sede.nombre || ''))
            }
            if (a.fechaMinMs === null) return 1
            if (b.fechaMinMs === null) return -1
            if (a.fechaMinMs !== b.fechaMinMs) return a.fechaMinMs - b.fechaMinMs
            return String(a.sede.nombre || '').localeCompare(String(b.sede.nombre || ''))
        })
        .map((item) => item.sede)
}

// Ordena las sedes según el orden guardado por el técnico (orden_bloqueado):
// conserva la posición de las que siguen vigentes y anexa al final las nuevas
// (en orden de antigüedad) para que el reordenamiento manual no se revierta.
const reconciliarOrden = (detalleExistente, sedesOrdenadas) => {
    const autoSet = new Set(sedesOrdenadas.map((s) => s.sede_id))
    const result = []
    for (const d of detalleExistente) {
        if (autoSet.has(d.sede_id) && !result.includes(d.sede_id)) {
            result.push(d.sede_id)
        }
    }
    for (const sede of sedesOrdenadas) {
        if (!result.includes(sede.sede_id)) {
            result.push(sede.sede_id)
        }
    }
    return result
}

// Adjunta a cada ticket/orden la sede asignada manualmente (ticket_georef),
// de modo que la ruta del día incluya la georreferenciación manual.
const enriquecerConGeorefManual = async (entradas) => {
    if (!entradas || entradas.length === 0) return entradas

    const tipos = new Set()
    const ids = new Set()
    for (const e of entradas) {
        if (e.type && e.id && e.id !== 'Sin ID') {
            tipos.add(e.type)
            ids.add(e.id)
        }
    }
    if (tipos.size === 0 || ids.size === 0) return entradas

    const manuales = await TicketGeoref.findAll({
        where: {
            tipo: { [Op.in]: [...tipos] },
            request_id: { [Op.in]: [...ids] },
        }
    })
    if (manuales.length === 0) return entradas

    const sedesPorId = new Map()
    if (manuales.some((m) => m.sede_id)) {
        const sedes = await Sede.findAll({
            where: { sede_id: { [Op.in]: [...new Set(manuales.map((m) => m.sede_id))] } }
        })
        for (const s of sedes) sedesPorId.set(s.sede_id, s)
    }

    const manualPorPar = new Map()
    for (const m of manuales) manualPorPar.set(`${m.tipo}|${m.request_id}`, m)

    return entradas.map((e) => {
        if (!e.type || !e.id) return e
        const manual = manualPorPar.get(`${e.type}|${e.id}`)
        const sede = manual && sedesPorId.get(manual.sede_id)
        if (!sede) return e
        return { ...e, sedeManual: sede }
    })
}

// Crea (o reemplaza) la ruta del día de un técnico según sus tickets/órdenes abiertos.
// Las georreferenciaciones manuales (ticket_georef) del técnico se incluyen SIEMPRE,
// aunque el ticket no aparezca en la consulta a Helix (p. ej. recién creados).
const sincronizarRutaDelDia = async (tecnico, { tickets = [], workOrders = [] } = {}) => {
    const sedes = await Sede.findAll()
    const mapaCorreoSede = construirMapaCorreoSede(sedes)

    const entradasBase = [...tickets, ...workOrders]
    if (tecnico?.usuario_id) {
        const manuales = await TicketGeoref.findAll({
            where: { usuario_id: tecnico.usuario_id },
        })
        for (const m of manuales) {
            if (!m.request_id) continue
            entradasBase.push({
                type: m.tipo,
                id: m.request_id,
                email: null,
                fechaCreacion: m.fecha,
            })
        }
    }

    const entradas = await enriquecerConGeorefManual(entradasBase)
    const sedesOrdenadas = calcularSedesDelDia(entradas, mapaCorreoSede)

    if (sedesOrdenadas.length === 0) return null

    const fecha = fechaHoyLocal()
    const descripcion = `Automática (${sedesOrdenadas.length} sede${sedesOrdenadas.length === 1 ? '' : 's'})`

    const t = await sequelize.transaction()
    try {
        const existente = await Ruta.findOne({ where: { usuario_id: tecnico.usuario_id, fecha } }, { transaction: t })

        let ruta
        let idsFinales = sedesOrdenadas.map((sede) => sede.sede_id)
        if (existente) {
            ruta = existente
            if (existente.orden_bloqueado) {
                const detalleExistente = await RutaSede.findAll({
                    where: { ruta_id: ruta.ruta_id },
                    order: [['orden', 'ASC']],
                    transaction: t,
                })
                idsFinales = reconciliarOrden(detalleExistente, sedesOrdenadas)
            }
            await Ruta.update(
                { descripcion },
                { where: { ruta_id: ruta.ruta_id }, transaction: t }
            )
            await RutaSede.destroy({ where: { ruta_id: ruta.ruta_id }, transaction: t })
        } else {
            ruta = await Ruta.create(
                { usuario_id: tecnico.usuario_id, fecha, estado: 'Planificada', descripcion, orden_bloqueado: false },
                { transaction: t }
            )
        }

        await RutaSede.bulkCreate(
            idsFinales.map((sede_id, i) => ({
                ruta_id: ruta.ruta_id,
                sede_id,
                orden: i + 1
            })),
            { transaction: t }
        )

        await t.commit()

        registrarBitacora({
            tipo: existente ? 'ruta_editada' : 'ruta_creada',
            descripcion: `Ruta ${existente ? 'actualizada' : 'creada'} para ${tecnico.nombreCompleto} el ${fecha} con ${sedesOrdenadas.length} sedes (automática por tickets)`,
            usuario: tecnico.usuario,
        })

        return ruta
    } catch (error) {
        await t.rollback()
        throw error
    }
}

module.exports = { sincronizarRutaDelDia, calcularSedesDelDia, construirMapaCorreoSede, normalizarCorreos, fechaHoyLocal }