const { Router } = require('express')
const { getUsuarios, getUsuario,   updateUsuario, createUsuario } = require('../controllers/usuarios.controller')

const routerUser = Router()

routerUser.get('/usuarios', getUsuarios)

// routerUser.get('/usuarios_admin', getAllUsuarios)

// routerUser.get('/usuarios_agentes', getUsuariosAgentes)

routerUser.put('/usuario/:usuario_id', updateUsuario)

routerUser.get('/usuario/:usuario_id', getUsuario)

routerUser.post('/usuario', createUsuario)

module.exports = { routerUser }