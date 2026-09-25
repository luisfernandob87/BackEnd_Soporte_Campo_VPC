const { DataTypes } = require('sequelize')
const { sequelize } = require('../database/database')

const TicketGeoref = sequelize.define('ticket_georef', {
    ticket_georef_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    tipo: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    request_id: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    sede_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    usuario_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    fecha: {
        type: DataTypes.DATE,
        allowNull: true,
    }
}, {
    tableName: 'ticket_georef',
    indexes: [
        { unique: true, fields: ['tipo', 'request_id'] }
    ]
})

module.exports = { TicketGeoref }