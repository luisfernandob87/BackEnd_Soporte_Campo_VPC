const { sequelize } = require('./database');

// Modelos que forman el esquema. Sequelize pluraliza los nombres de forma
// irregular, así que las tablas reales NO coinciden con el archivo:
//   bitacora -> bitacoras, notificacion -> notificacions, ruta -> ruta,
//   ruta_sede -> ruta_sedes, sede -> sedes, ticket_georef -> ticket_georef,
//   ticket_visto -> ticket_vistos, ubicacion -> ubicacions, usuario -> usuarios
// El nombre real se siempre de model.getTableName(), nunca seassume.
const MODELOS = [
    'usuario.model',
    'ubicacion.model',
    'sede.model',
    'ruta.model',
    'ruta_sede.model',
    'bitacora.model',
    'notificacion.model',
    'ticket_georef.model',
    'ticket_visto.model',
];

const cargarModelos = () => {
    for (const modelo of MODELOS) {
        require(`../models/${modelo}`);
    }
    return sequelize.models;
};

const columnasDe = async (tabla) => {
    const filas = await sequelize.query(
        'SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2',
        { bind: ['public', tabla], type: sequelize.QueryTypes.SELECT }
    );
    return new Set(filas.map((f) => f.column_name));
};

// Valor por defecto del modelo como literal SQL. DataTypes.NOW es una función y
// no un valor, por eso se devuelve null y se resuelve luego por tipo.
const literalPorDefecto = (atributo) => {
    const defecto = atributo.defaultValue;
    if (defecto === undefined || defecto === null || typeof defecto === 'function') {
        return null;
    }
    if (typeof defecto === 'boolean') return defecto ? 'TRUE' : 'FALSE';
    if (typeof defecto === 'number') return String(defecto);
    return `'${String(defecto).replace(/'/g, "''")}'`;
};

// Valor de relleno para una columna NOT NULL nueva en una tabla que ya tiene
// filas, según el tipo que Sequelize declare para ese atributo.
const literalPorTipo = (ddl) => {
    const tipo = String(ddl).toUpperCase();
    if (tipo.includes('TIMESTAMP') || tipo.includes('DATE') || tipo.includes('TIME')) return 'NOW()';
    if (tipo.includes('BOOL')) return 'FALSE';
    if (/INT|FLOAT|NUMERIC|DOUBLE|DECIMAL|REAL/.test(tipo)) return '0';
    return "''";
};

const agregarColumnasFaltantes = async (modelos, log, dryRun) => {
    const pendientes = [];
    for (const modelo of Object.values(modelos)) {
        const tabla = modelo.getTableName();
        const existentes = await columnasDe(tabla);
        for (const [campo, atributo] of Object.entries(modelo.getAttributes())) {
            if (!existentes.has(campo)) {
                pendientes.push({ tabla, campo, atributo });
            }
        }
    }

    if (pendientes.length === 0) {
        log('[db] esquema al día: no falta ninguna columna');
        return [];
    }

    for (const p of pendientes) {
        log(`[db] falta ${p.tabla}.${p.campo} (${p.atributo.type.toSql()})`);
    }
    if (dryRun) {
        log('[db] DRY RUN: no se ejecuta ningún cambio');
        return pendientes.map((p) => `${p.tabla}.${p.campo}`);
    }

    // En PostgreSQL el DDL es transaccional: si algo falla a mitad, se revierte
    // todo y la base queda como estaba. Importante porque estas escrituras caen
    // sobre tablas que ya tienen datos.
    const agregadas = await sequelize.transaction(async (t) => {
        const agregadas = [];
        for (const { tabla, campo, atributo } of pendientes) {
            const ddl = atributo.type.toSql();
            const defecto = literalPorDefecto(atributo);
            await sequelize.query(
                `ALTER TABLE "${tabla}" ADD COLUMN IF NOT EXISTS "${campo}" ${ddl}` +
                    (defecto ? ` DEFAULT ${defecto}` : ''),
                { transaction: t }
            );
            if (atributo.allowNull === false) {
                // La columna se agregó como nulables; primero se rellena y sólo
                // después se exige NOT NULL, porque agregarla ya como NOT NULL
                // falla si la tabla tiene filas.
                const relleno = defecto || literalPorTipo(ddl);
                await sequelize.query(
                    `UPDATE "${tabla}" SET "${campo}" = ${relleno} WHERE "${campo}" IS NULL`,
                    { transaction: t }
                );
                await sequelize.query(
                    `ALTER TABLE "${tabla}" ALTER COLUMN "${campo}" SET NOT NULL`,
                    { transaction: t }
                );
            }
            agregadas.push(`${tabla}.${campo}`);
            log(`[db] columna agregada ${tabla}.${campo}`);
        }
        return agregadas;
    });

    return agregadas;
};

/**
 * Migración de datos conocida: la columna vieja en minúsculas "idusuario" que
 * quedó en algunas bases. Copia sus valores a "idUsuario" y recién ahí la
 * borra. Sin esto, el paso genérico agregaría "idUsuario" con valor 0 y se
 * perdería el historial de ubicaciones.
 */
const migrarIdUsuario = async (log, dryRun) => {
    const tabla = 'ubicacions';
    const existentes = await columnasDe(tabla);
    if (!existentes.has('idusuario')) return false;

    log(`[db] ${tabla}.idusuario (minúsculas) detectada: sus datos se copian a idUsuario`);
    if (dryRun) {
        log('[db] DRY RUN: no se ejecuta ningún cambio');
        return false;
    }

    await sequelize.transaction(async (t) => {
        if (!existentes.has('idUsuario')) {
            await sequelize.query(
                `ALTER TABLE "${tabla}" ADD COLUMN IF NOT EXISTS "idUsuario" INTEGER NOT NULL DEFAULT 0`,
                { transaction: t }
            );
        }
        await sequelize.query(
            `UPDATE "${tabla}" SET "idUsuario" = idusuario WHERE "idUsuario" IS NULL OR "idUsuario" = 0`,
            { transaction: t }
        );
        await sequelize.query(`ALTER TABLE "${tabla}" DROP COLUMN "idusuario"`, { transaction: t });
    });

    log(`[db] ${tabla}.idusuario migrada y eliminada`);
    return true;
};

/**
 * Columnas que ya no usa ningún modelo. Es el único paso destructivo del
 * script, así que va apagado: sólo corre con DB_DROP_OBSOLETAS=true.
 */
const eliminarColumnasObsoletas = async (log, dryRun) => {
    if (process.env.DB_DROP_OBSOLETAS !== 'true') return [];

    const objetivo = [
        { tabla: 'usuarios', columnas: ['latitud', 'longitud'] },
    ];
    const eliminadas = [];
    for (const { tabla, columnas } of objetivo) {
        const existentes = await columnasDe(tabla);
        const sobrantes = columnas.filter((c) => existentes.has(c));
        if (sobrantes.length === 0) continue;
        log(`[db] ${tabla}: quitando columnas obsoletas ${sobrantes.join(', ')}`);
        if (dryRun) continue;
        for (const columna of sobrantes) {
            await sequelize.query(`ALTER TABLE "${tabla}" DROP COLUMN IF EXISTS "${columna}"`);
            eliminadas.push(`${tabla}.${columna}`);
        }
    }
    return eliminadas;
};

/**
 * Deja el esquema igual que los modelos: crea las tablas que falten y agrega
 * las columnas que falten. Nunca borra tablas, nunca modifica columnas que ya
 * existen y nunca borra filas. Es idempotente, así que se puede correr en cada
 * arranque sin riesgo.
 */
const sincronizarEsquema = async ({ log = console.log, dryRun = process.env.DB_DRY_RUN === '1' } = {}) => {
    const modelos = cargarModelos();
    const dialecto = sequelize.getDialect();

    await sequelize.authenticate();
    log(`[db] conectado (${dialecto})${dryRun ? ' en DRY RUN' : ''}`);

    const faltantes = [];
    for (const modelo of Object.values(modelos)) {
        const tabla = modelo.getTableName();
        const existe = await sequelize.getQueryInterface().tableExists(tabla);
        if (!existe) faltantes.push(tabla);
    }
    log(faltantes.length ? `[db] creando tablas: ${faltantes.join(', ')}` : '[db] todas las tablas existen');

    // sync({ force: false }) sólo crea tablas que falten. Sobre una tabla que ya
    // existe es un no-op: no agrega columnas, no crea índices y no borra nada.
    if (!dryRun) await sequelize.sync({ force: false });

    let columnas = [];
    if (dialecto === 'postgres') {
        columnas = await agregarColumnasFaltantes(modelos, log, dryRun);
    } else {
        log(`[db] dialecto "${dialecto}" sin soporte: sólo se crean tablas, no se ajustan columnas`);
    }

    await migrarIdUsuario(log, dryRun);
    const obsoletas = await eliminarColumnasObsoletas(log, dryRun);

    if (dryRun) {
        log('[db] DRY RUN terminé: no se aplicó ningún cambio');
    } else {
        log(`[db] listo. Tablas creadas: ${faltantes.length} | columnas agregadas: ${columnas.length} | columnas obsoletas eliminadas: ${obsoletas.length}`);
    }

    return { tablasCreadas: faltantes, columnasAgregadas: columnas, columnasEliminadas: obsoletas };
};

module.exports = { sincronizarEsquema, cargarModelos, columnasDe };
