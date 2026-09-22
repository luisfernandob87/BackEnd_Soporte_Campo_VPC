const { DataTypes } = require('sequelize')
const { sequelize } = require('../database/database')
const { Usuario } = require('./usuario.model')
const { RutaSede } = require('./ruta_sede.model')

const Ruta = sequelize.define('ruta', {
    ruta_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    usuario_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    fecha: {
        type: DataTypes.DATEONLY,
        allowNull: false,
    },
    estado: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'Planificada'
    },
    descripcion: {
        type: DataTypes.STRING,
        allowNull: true,
    }
}, {
    indexes: [
        { unique: true, fields: ['usuario_id', 'fecha'] }
    ]
})

Ruta.hasMany(RutaSede, {
    foreignKey: 'ruta_id',
    sourceKey: 'ruta_id',
    as: 'detalles',
    onDelete: 'CASCADE'
})

Ruta.belongsTo(Usuario, {
    foreignKey: 'usuario_id',
    targetKey: 'usuario_id'
})

module.exports = { Ruta }