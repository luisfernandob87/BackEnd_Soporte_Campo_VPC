require('dotenv').config();
const express = require("express")
const axios = require('axios');
const https = require('https');
const { URLSearchParams } = require('url'); // Added URLSearchParams
const { routerUser } = require('./routes/usuario.routes')
// const { routerAut } = require('./controllers/auth.controller')
const {routerUbicacion} = require('./routes/ubicacion.routes')
// const { syncUsersFromLDAP } = require('./controllers/auth.controller');
const { routerSede } = require('./routes/sede.routes');

const cors = require("cors");

const app = express()

const BMC_BASE_URL = process.env.BMC_BASE_URL;
const BMC_USERNAME = process.env.BMC_USERNAME;
const BMC_PASSWORD = process.env.BMC_PASSWORD;

const httpsAgent = new https.Agent({
  rejectUnauthorized: false, // ⚠️ Solo para pruebas
});

//middleware
app.use(cors());
app.use(express.json())
app.use(express.urlencoded({ extended: false }))
// app.use(routerAut)
app.use(routerUser)
app.use(routerUbicacion)
app.use(routerSede)

// Ruta para generar el token
app.post('/api/token', async (req, res) => { // Changed from app.get to app.post
  try {
    const encodedParams = new URLSearchParams();
    encodedParams.set('username', BMC_USERNAME);
    encodedParams.set('password', BMC_PASSWORD);

    const options = {
      method: 'POST',
      url: `${BMC_BASE_URL}/api/jwt/login`,
      headers: {
        Accept: '*/*',
        'User-Agent': 'YourAppName',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      data: encodedParams,
      httpsAgent // Added httpsAgent to the request
    };

    const { data: token } = await axios.request(options);
    res.json({ token });
    console.log('Token generado:', token);

  } catch (error) {
    console.error('Error al obtener el token:', error.response?.data || error.message);
    res.status(500).json({ error: 'No se pudo obtener el token' });
  }
});

module.exports = { app }