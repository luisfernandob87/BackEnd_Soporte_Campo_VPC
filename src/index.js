const { app } = require('./app')
const { sequelize } = require('./database/database')


async function main() {
    try {
        await sequelize.authenticate()

        await sequelize.sync({ force: false})
        console.log("Conection succesfully");
        const PORT = process.env.PORT || 4000;

        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    } catch (error) {
        console.error("Error de conexion"+ error)
    }
}

main()
