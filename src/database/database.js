
// PostgrestSQL
const Sequelize = require('sequelize')

const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASS, {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'postgres'
})

module.exports = { sequelize }

// const { Sequelize } = require('sequelize');


// const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASS, {
//     dialect: 'mssql',
//     host: process.env.DB_HOST,
//     port: process.env.DB_PORT,
//     dialectOptions: {
//         options: {
//           encrypt: true,
//           trustServerCertificate: true
//         }}
// })

// module.exports = { sequelize }