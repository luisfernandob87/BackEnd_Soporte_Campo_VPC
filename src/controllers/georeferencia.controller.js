const {
    obtenerTicketsGeoreferencia,
    asignarGeoreferencia: asignarGeoreferenciaService,
    quitarGeoreferencia: quitarGeoreferenciaService,
} = require('../services/georreferenciacion.service')
const { sequelize } = require('../database/database')
const { Usuario } = require('../models/usuario.model')
const { obtenerTicketsAbiertosDeTecnico } = require('../services/ticketsHelix.service')
const { sincronizarRutaDelDia } = require('../services/rutaAutomatica.service')

// Busca el técnico registrado por su login (case-insensitive).
const buscarTecnicoPorLogin = async (usuario) => {
    if (!usuario) return null
    const login = String(usuario).trim()
    if (!login) return null
    return Usuario.findOne({
        where: sequelize.where(
            sequelize.fn('lower', sequelize.col('usuario')),
            login.toLowerCase()
        )
    })
}

// Recalcula de inmediato la ruta del día del técnico que recibió la asignación
// manual, para que la nueva sede aparezca sin esperar el polling del watcher.
const recargarRutaDeTecnico = async (usuario) => {
    try {
        const tecnico = await buscarTecnicoPorLogin(usuario)
        if (!tecnico) return
        const { tickets, workOrders } = await obtenerTicketsAbiertosDeTecnico(tecnico.usuario)
        await sincronizarRutaDelDia(tecnico, { tickets, workOrders })
    } catch (error) {
        console.error('Error al sincronizar ruta tras georreferenciar:', error.message)
    }
}

const getTicketsGeoreferencia = async (req, res) => {
    try {
        const data = await obtenerTicketsGeoreferencia(req.query.tecnico || '')
        res.json(data)
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
}

const asignarGeoreferencia = async (req, res) => {
    try {
        const { tipo, request_id, sede_id, usuario } = req.body
        const tecnico = await buscarTecnicoPorLogin(usuario)
        const error = await asignarGeoreferenciaService({
            tipo,
            request_id,
            sede_id,
            usuario_id: tecnico ? tecnico.usuario_id : null,
        })
        if (error) return res.status(400).json({ message: error })
        recargarRutaDeTecnico(usuario)
        res.json({ message: 'Ticket georreferenciado correctamente' })
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
}

const quitarGeoreferencia = async (req, res) => {
    try {
        const { tipo, request_id, usuario } = req.query
        const error = await quitarGeoreferenciaService({ tipo, request_id })
        if (error) return res.status(400).json({ message: error })
        recargarRutaDeTecnico(usuario)
        res.json({ message: 'Georreferenciación manual eliminada' })
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
}

module.exports = { getTicketsGeoreferencia, asignarGeoreferencia, quitarGeoreferencia }