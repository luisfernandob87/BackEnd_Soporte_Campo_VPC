const { DataTypes } = require('sequelize')
const { sequelize } = require('../database/database')

const Ubicacion = sequelize.define('ubicacion', {
    ubicacion_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    latitud: {
        type: DataTypes.STRING,
        allowNull: false
    },
    longitud: {
        type: DataTypes.STRING,
        allowNull: false
    }
})

module.exports = { Ubicacion }