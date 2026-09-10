const { DataTypes } = require('sequelize')
const { sequelize } = require('../database/database')
const { Sede } = require('./sede.model')

const RutaSede = sequelize.define('ruta_sede', {
    detalle_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    ruta_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    sede_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    orden: {
        type: DataTypes.INTEGER,
        allowNull: false
    }
}, {
    indexes: [
        { unique: true, fields: ['ruta_id', 'sede_id'] }
    ]
})

RutaSede.belongsTo(Sede, {
    foreignKey: 'sede_id',
    targetKey: 'sede_id'
})

module.exports = { RutaSede }