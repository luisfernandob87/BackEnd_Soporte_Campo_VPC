const { sequelize } = require('../database/database')
const { Ruta } = require('../models/ruta.model')
const { RutaSede } = require('../models/ruta_sede.model')
const { Sede } = require('../models/sede.model')
const { Usuario } = require('../models/usuario.model')
const { registrarBitacora } = require('./bitacora.controller')

const ESTADOS_VALIDOS = ['Planificada', 'En curso', 'Completada', 'Cancelada']

const normalizarSedes = (sedes) => {
    if (!Array.isArray(sedes)) return null
    const ids = sedes.map((s) => {
        if (typeof s === 'object' && s !== null) return Number(s.sede_id ?? s.detalle_id ?? s)
        return Number(s)
    })
    if (ids.some((id) => !Number.isInteger(id) || id <= 0)) return null
    return ids
}

const cargarRuta = async (id) => {
    const ruta = await Ruta.findByPk(id, {
        include: [
            {
                model: RutaSede,
                as: 'detalles',
                include: [{ model: Sede }],
                order: [['orden', 'ASC']]
            },
            { model: Usuario }
        ]
    })
    if (!ruta) return null
    return {
        ruta_id: ruta.ruta_id,
        usuario_id: ruta.usuario_id,
        fecha: ruta.fecha,
        estado: ruta.estado,
        descripcion: ruta.descripcion,
        nombreCompleto: ruta.usuario ? ruta.usuario.nombreCompleto : null,
        sedes: (ruta.detalles || [])
            .slice()
            .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
            .map((d) => ({
                detalle_id: d.detalle_id,
                sede_id: d.sede_id,
                orden: d.orden,
                nombre: d.sede ? d.sede.nombre : null,
                tipo: d.sede ? d.sede.tipo : null,
                direccion: d.sede ? d.sede.direccion : null,
                latitud: d.sede ? d.sede.latitud : null,
                longitud: d.sede ? d.sede.longitud : null,
            })),
    }
}

const getRutas = async (req, res) => {
    try {
        const rutas = await Ruta.findAll({
            order: [['fecha', 'DESC'], ['ruta_id', 'DESC']],
            include: [
                { model: RutaSede, as: 'detalles', attributes: ['detalle_id'] },
                { model: Usuario }
            ]
        })
        const data = rutas.map((r) => ({
            ruta_id: r.ruta_id,
            usuario_id: r.usuario_id,
            fecha: r.fecha,
            estado: r.estado,
            descripcion: r.descripcion,
            total_sedes: r.detalles ? r.detalles.length : 0,
            nombreCompleto: r.usuario ? r.usuario.nombreCompleto : null,
        }))
        res.json(data)
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
}

const getRuta = async (req, res) => {
    try {
        const ruta = await cargarRuta(req.params.ruta_id)
        if (!ruta) {
            return res.status(404).json({ message: 'Ruta no encontrada' })
        }
        res.json(ruta)
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
}

const createRuta = async (req, res) => {
    try {
        const { usuario_id, fecha, estado = 'Planificada', descripcion = null, sedes } = req.body
        const sedesIds = normalizarSedes(sedes)

        if (!usuario_id || !fecha) {
            return res.status(400).json({ message: 'usuario_id y fecha son requeridos' })
        }
        if (!ESTADOS_VALIDOS.includes(estado)) {
            return res.status(400).json({ message: 'Estado inválido' })
        }
        if (!sedesIds || sedesIds.length === 0) {
            return res.status(400).json({ message: 'Debe enviar la lista de sedes en orden de visita' })
        }
        if (new Set(sedesIds).size !== sedesIds.length) {
            return res.status(400).json({ message: 'No se permiten sedes repetidas' })
        }

        const usuario = await Usuario.findByPk(usuario_id)
        if (!usuario) {
            return res.status(400).json({ message: 'El técnico no existe' })
        }

        const t = await sequelize.transaction()
        try {
            const ruta = await Ruta.create({ usuario_id, fecha, estado, descripcion }, { transaction: t })
            await RutaSede.bulkCreate(
                sedesIds.map((sede_id, i) => ({ ruta_id: ruta.ruta_id, sede_id, orden: i + 1 })),
                { transaction: t }
            )
            await t.commit()
            registrarBitacora({
                tipo: 'ruta_creada',
                descripcion: `Ruta creada para ${usuario.nombreCompleto} el ${fecha} con ${sedesIds.length} sedes`,
                usuario: usuario.usuario,
            })
            res.json(await cargarRuta(ruta.ruta_id))
        } catch (error) {
            await t.rollback()
            if (error && error.name === 'SequelizeUniqueConstraintError') {
                return res.status(400).json({ message: 'Ya existe una ruta para este técnico en esta fecha' })
            }
            throw error
        }
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
}

const updateRuta = async (req, res) => {
    try {
        const { ruta_id } = req.params
        const { usuario_id, fecha, estado, descripcion, sedes } = req.body

        const existente = await Ruta.findByPk(ruta_id)
        if (!existente) {
            return res.status(404).json({ message: 'Ruta no encontrada' })
        }

        const campos = {}
        if (usuario_id !== undefined) campos.usuario_id = usuario_id
        if (fecha !== undefined) campos.fecha = fecha
        if (descripcion !== undefined) campos.descripcion = descripcion
        if (estado !== undefined) {
            if (!ESTADOS_VALIDOS.includes(estado)) {
                return res.status(400).json({ message: 'Estado inválido' })
            }
            campos.estado = estado
        }

        let sedesIds = null
        if (sedes !== undefined) {
            sedesIds = normalizarSedes(sedes)
            if (!sedesIds || sedesIds.length === 0) {
                return res.status(400).json({ message: 'Debe enviar la lista de sedes en orden de visita' })
            }
            if (new Set(sedesIds).size !== sedesIds.length) {
                return res.status(400).json({ message: 'No se permiten sedes repetidas' })
            }
        }

        const t = await sequelize.transaction()
        try {
            await Ruta.update(campos, { where: { ruta_id }, transaction: t })
            if (sedesIds) {
                await RutaSede.destroy({ where: { ruta_id }, transaction: t })
                await RutaSede.bulkCreate(
                    sedesIds.map((sede_id, i) => ({ ruta_id, sede_id, orden: i + 1 })),
                    { transaction: t }
                )
            }
            await t.commit()
            registrarBitacora({ tipo: 'ruta_editada', descripcion: `Ruta ${ruta_id} actualizada` })
            res.json(await cargarRuta(ruta_id))
        } catch (error) {
            await t.rollback()
            if (error && error.name === 'SequelizeUniqueConstraintError') {
                return res.status(400).json({ message: 'Ya existe una ruta para este técnico en esta fecha' })
            }
            throw error
        }
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
}

const deleteRuta = async (req, res) => {
    try {
        const { ruta_id } = req.params
        const existente = await Ruta.findByPk(ruta_id)
        if (!existente) {
            return res.status(404).json({ message: 'Ruta no encontrada' })
        }
        await Ruta.destroy({ where: { ruta_id } })
        registrarBitacora({ tipo: 'ruta_eliminada', descripcion: `Ruta ${ruta_id} eliminada` })
        res.json({ message: 'Ruta eliminada' })
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
}

module.exports = { getRutas, getRuta, createRuta, updateRuta, deleteRuta }