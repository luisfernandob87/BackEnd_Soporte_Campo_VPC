const { DataTypes } = require('sequelize')
const { sequelize } = require('../database/database')

const Ubicacion = sequelize.define('ubicacion', {
    ubicacion_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    idUsuario: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    latitud: {
        type: DataTypes.STRING,
        allowNull: false
    },
    longitud: {
        type: DataTypes.STRING,
        allowNull: false
    },
    accuracy: {
        type: DataTypes.FLOAT,
        allowNull: true
    },
    timestamp: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    }
})

module.exports = { Ubicacion }