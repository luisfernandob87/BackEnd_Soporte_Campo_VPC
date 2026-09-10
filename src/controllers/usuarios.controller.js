const { Usuario } = require('../models/usuario.model')
const { registrarBitacora } = require('./bitacora.controller')



const getUsuarios = async (req, res) => {

    try {
        const usuarios = await Usuario.findAll({
            where:{ status: 'Activo'}
        })
        res.json(usuarios)
    } catch (error) {
        return res.status(500).json({ message: error.message })
    }
}

const getAllUsuarios = async (req, res) => {
    try {
        const usuarios = await Usuario.findAll({
            order: [['nombreCompleto', 'ASC']]
        })
        res.json(usuarios)
    } catch (error) {
        return res.status(500).json({ message: error.message })
    }
}

const getUsuario = async (req, res) => {
    const { usuario_id } = req.params
    try {
        const usuario = await Usuario.findOne({
            where: { usuario_id },
        })
        res.json(usuario)
    } catch (error) {
        return res.status(500).json({ message: error.message })
    }
}

const createUsuario = async (req, res) => {
    const { usuario, nombreCompleto, rol = '', status = 'Activo' } = req.body
    try {
        const createUsuario = await Usuario.create({
        usuario,
        rol,
        nombreCompleto,
        status,
        })
        registrarBitacora({
            tipo: 'usuario_creado',
            descripcion: `Técnico creado: ${createUsuario.nombreCompleto}`
        })
        res.json(createUsuario)
    } catch (error) {
        return res.status(500).json({ message: error.message })
    }
}

const updateUsuario = async (req, res) => {
    const { usuario_id } = req.params;
    const updUser = await Usuario.findOne({
        where: {usuario_id}
    })
    updUser.set(req.body)
    await updUser.save()
    registrarBitacora({
        tipo: 'usuario_editado',
        descripcion: `Técnico actualizado: ${updUser.nombreCompleto || usuario_id}`
    })
    return res.json(updUser)
    };


module.exports = { getUsuarios, getAllUsuarios, getUsuario, updateUsuario, createUsuario }