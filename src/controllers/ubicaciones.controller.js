const { Ubicacion } = require('../models/ubicacion.model')


const createUbicacion = async (req, res) => {
    const { latitud, longitud } = req.body
    const newUbicacion = await Ubicacion.create({
        latitud,
        longitud
    })

    res.json(newUbicacion)
}

const getUbicacion = async (req, res) => {
    try {
        const ubicacion = await Ubicacion.findAll({
        })
        res.json(ubicacion)
    } catch (error) {
        return res.status(500).json({ message: error.message })
    }
}

// const updateUbicacion = async (req, res) => {
//     const { ubicacion_id } = req.params
//     const updMarcas = await Marcas.findOne({
//         where: { marca_id }
//     })
//     updMarcas.set(req.body)
//     await updMarcas.save()
//     return res.json(updMarcas)
// }

module.exports = { createUbicacion, getUbicacion }