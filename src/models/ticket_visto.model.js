const { DataTypes } = require('sequelize')
const { sequelize } = require('../database/database')
const { Usuario } = require('./usuario.model')

const TicketVisto = sequelize.define('ticket_visto', {
    ticket_visto_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    tipo: {
        type: DataTypes.STRING,
        allowNull: false
    },
    request_id: {
        type: DataTypes.STRING,
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
    fecha: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    }
}, {
    indexes: [
        {
            unique: true,
            fields: ['tipo', 'request_id', 'usuario_id']
        }
    ]
})

module.exports = { TicketVisto }