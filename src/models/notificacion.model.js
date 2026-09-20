const { DataTypes } = require('sequelize')
const { sequelize } = require('../database/database')
const { Usuario } = require('./usuario.model')

const Notificacion = sequelize.define('notificacion', {
    notificacion_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    usuario_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: Usuario,
            key: 'usuario_id'
        }
    },
    mensaje: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    estado: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'Pendiente'
    },
    fecha: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    datos_ticket: {
        type: DataTypes.TEXT,
        allowNull: true
    }
})

Usuario.hasMany(Notificacion, {
    foreignKey: 'usuario_id',
    sourceKey: 'usuario_id'
})

Notificacion.belongsTo(Usuario, {
    foreignKey: 'usuario_id',
    targetKey: 'usuario_id'
})

module.exports = { Notificacion }