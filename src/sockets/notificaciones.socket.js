const { WebSocketServer, WebSocket } = require('ws');

// Mapa: usuario_id -> Set de sockets conectados
const usuariosConectados = new Map();

const inicializarWebSocket = (server) => {
    const wss = new WebSocketServer({ server });

    wss.on('connection', (ws, req) => {
        const usuario_id = obtenerUsuarioIdSolicitud(req);
        if (!usuario_id) {
            ws.close(4001, 'usuario_id requerido');
            return;
        }

        if (!usuariosConectados.has(usuario_id)) {
            usuariosConectados.set(usuario_id, new Set());
        }
        usuariosConectados.get(usuario_id).add(ws);

        console.log(`[WS] Cliente conectado: usuario_id=${usuario_id} (conectados: ${usuariosConectados.size})`);

        ws.on('close', () => {
            const sockets = usuariosConectados.get(usuario_id);
            if (sockets) {
                sockets.delete(ws);
                if (sockets.size === 0) {
                    usuariosConectados.delete(usuario_id);
                }
            }
        });

        ws.on('error', () => {
            // El manejador 'close' libera el socket
        });
    });
};

const obtenerUsuarioIdSolicitud = (req) => {
    try {
        const query = (req.url || '').split('?')[1] || '';
        const params = new URLSearchParams(query);
        const valor = params.get('usuario_id');
        if (!valor) return null;
        return String(valor).trim();
    } catch {
        return null;
    }
};

const estaConectado = (usuario_id) =>
    usuariosConectados.has(String(usuario_id)) &&
    usuariosConectados.get(String(usuario_id)).size > 0;

const enviarNotificacion = (usuario_id, payload) => {
    const sockets = usuariosConectados.get(String(usuario_id));
    if (!sockets) return false;
    const mensaje = JSON.stringify(payload);
    for (const ws of sockets) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(mensaje);
        }
    }
    return true;
};

module.exports = { inicializarWebSocket, estaConectado, enviarNotificacion };