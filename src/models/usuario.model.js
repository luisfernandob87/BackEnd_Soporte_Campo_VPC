const { DataTypes } = require('sequelize')
const { sequelize } = require('../database/database')
const { Ubicacion } = require('./ubicacion.model')

const Usuario = sequelize.define('usuario', {
    usuario_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    usuario: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    rol: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    nombreCompleto: {
        type: DataTypes.STRING,
        allowNull: false
    },
    status:{
        type: DataTypes.STRING,
        allowNull: false,
    },
    latitud:{
        type: DataTypes.STRING,
        allowNull: false,
    },
    longitud:{
        type: DataTypes.STRING,
        allowNull: false,
    }
})


Usuario.hasMany(Ubicacion, {
    foreignKey: 'idUsuario',
    sourceKey: 'usuario_id'
})

Ubicacion.belongsTo(Usuario, {
    foreignKey: 'idUsuario',
    targetKey: 'usuario_id'
})


module.exports = { Usuario }