require('dotenv').config();
const express = require("express")
const axios = require('axios');
const https = require('https');
const { URLSearchParams } = require('url'); // Added URLSearchParams
const { routerUser } = require('./routes/usuario.routes')
// const { routerAut } = require('./controllers/auth.controller')
const { routerUbicacion } = require('./routes/ubicacion.routes')
// const { syncUsersFromLDAP } = require('./controllers/auth.controller');
const { routerSede } = require('./routes/sede.routes');
const { routerBitacora } = require('./routes/bitacora.routes');
const { routerRuta } = require('./routes/ruta.routes');
const { registrarBitacora } = require('./controllers/bitacora.controller');
const { Usuario } = require('./models/usuario.model');

const cors = require("cors");

const app = express()

const BMC_BASE_URL = process.env.BMC_BASE_URL;
const BMC_USERNAME = process.env.BMC_USERNAME;
const BMC_PASSWORD = process.env.BMC_PASSWORD;

const httpsAgent = new https.Agent({
  rejectUnauthorized: false, // ⚠️ Solo para pruebas
});

//middleware
// Configuración de CORS
app.use(cors({
  origin: 'https://soporte-campo-vpc.onrender.com',
  // origin: 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json())
app.use(express.urlencoded({ extended: false }))
// app.use(routerAut)
app.use(routerUser)
app.use(routerUbicacion)
app.use(routerSede)
app.use(routerBitacora)
app.use(routerRuta)

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
    const usuarioLogin = req.body?.usuario || 'Desconocido';

    // Buscar el usuario en la base de datos; si no existe, crearlo
    let usuario = await Usuario.findOne({ where: { usuario: usuarioLogin } });
    if (!usuario) {
      usuario = await Usuario.create({
        usuario: usuarioLogin,
        rol: '',
        nombreCompleto: usuarioLogin,
        status: 'Activo',
      });
      registrarBitacora({
        tipo: 'usuario_creado',
        descripcion: `Usuario creado: ${usuario.nombreCompleto}`,
        usuario: usuarioLogin,
      });
    }

    // Solo los usuarios con rol de Coordinador pueden iniciar sesión
    if (String(usuario.rol).trim() === 'Coordinador') {
      registrarBitacora({
        tipo: 'login',
        descripcion: 'Inicio de sesión en el portal',
        usuario: usuarioLogin,
      });
      res.json({ token });
      console.log('Token generado:', token);
      return;
    }

    // Sin rol de Coordinador: no se otorga acceso y se notifica
    registrarBitacora({
      tipo: 'acceso_solicitado',
      descripcion: `Acceso solicitado para el usuario sin rol de Coordinador: ${usuarioLogin}`,
      usuario: usuarioLogin,
    });
    return res.status(403).json({
      message:
        'Tu usuario aún no tiene rol de Coordinador. Se notificará para poder brindar el acceso.',
    });

  } catch (error) {
    console.error('Error al obtener el token:', error.response?.data || error.message);
    res.status(500).json({ error: 'No se pudo obtener el token' });
  }
});

module.exports = { app }
