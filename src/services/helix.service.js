const axios = require('axios');
const https = require('https');
const { URLSearchParams } = require('url');

const BMC_BASE_URL = process.env.BMC_BASE_URL;
const BMC_USERNAME = process.env.BMC_USERNAME;
const BMC_PASSWORD = process.env.BMC_PASSWORD;

const httpsAgent = new https.Agent({
    rejectUnauthorized: false, // ⚠️ Solo para pruebas
});

// Cache del JWT AR System con TTL
let tokenCache = null;
const TOKEN_TTL_MS = 10 * 60 * 1000; // 10 minutos

const obtenerToken = async () => {
    if (tokenCache && Date.now() - tokenCache.generadoEn < TOKEN_TTL_MS) {
        return tokenCache.token;
    }

    const params = new URLSearchParams();
    params.set('username', BMC_USERNAME);
    params.set('password', BMC_PASSWORD);

    const { data: token } = await axios.request({
        method: 'POST',
        url: `${BMC_BASE_URL}/api/jwt/login`,
        headers: {
            Accept: '*/*',
            'User-Agent': 'SoporteCampoVPC',
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        data: params,
        httpsAgent,
        timeout: 15000,
    });

    tokenCache = { token, generadoEn: Date.now() };
    return token;
};

const getEntradas = async (form, query) => {
    const token = await obtenerToken();
    const { data } = await axios.request({
        method: 'GET',
        url: `${BMC_BASE_URL}/api/arsys/v1/entry/${encodeURIComponent(form)}?q=${encodeURIComponent(query)}`,
        headers: {
            Accept: '*/*',
            Authorization: `AR-JWT ${token}`,
        },
        httpsAgent,
        timeout: 20000,
    });
    return Array.isArray(data && data.entries) ? data.entries : [];
};

module.exports = { obtenerToken, getEntradas };