// const { Router } = require('express')
// const { Usuario } = require('../models/usuario.model')
// const ldap = require('ldapjs');
// const jwt = require('jsonwebtoken')
// const bcrypt = require('bcryptjs');
// const os = require("os");
// const { UniqueConstraintError } = require('sequelize');


// const routerAut = Router()

// // Configuración del cliente LDAP

// const client = ldap.createClient({
//   url: 'ldap://SDCCORPFRD',
//   reconnect: true,
//   timeout: 5000,
//   connectTimeout: 10000
// });
// client.on('error', (err) => {
//   console.error('LDAP connection error:', err);
// });

// // Función para autenticar con LDAP usando sAMAccountName
// function authenticateLDAP(username, password, callback) {
//   const userDN = `${username}@divinf.com`; // Cambia el dominio si es necesario

//   // Realizar el bind para autenticar
//   client.bind(userDN, password, (err) => {
//     if (err) {
//       console.error('Error al autenticar en LDAP:', err);
//       return callback(false); // Falla en la autenticación
//     }
//     console.log('Autenticación exitosa de ' + username);
//     callback(true); // Éxito en la autenticación
//   });
// }

// routerAut.post('/login', async (req, res, next) => {
//   const { usuario, password } = req.body;
//   const hostname = os.hostname(); // Obtiene el hostname del servidor

//   // Autenticar en LDAP
//   authenticateLDAP(usuario, password, async (success) => {
//     if (!success) {
//       return next("Error con credenciales");
//     }

//     // Buscar el usuario en la base de datos
//     const user = await Usuario.findOne({
//       where: { usuario } // Asumiendo que 'usuario' es el campo que guarda sAMAccountName
//     });

//     if (!user) {
//       return next("Usuario no encontrado en la base de datos");
//     }

//     // Verificar si el usuario tiene un rol permitido
//     const rolesPermitidos = ['Administrador', 'Agente', 'Coordinador'];
//     if (!rolesPermitidos.includes(user.rol)) { // Asumiendo que el campo 'rol' existe en la tabla Usuario
//       return next("Acceso denegado. No tiene el rol adecuado.");
//     }

//     user.password = undefined; // Remover la contraseña del objeto de usuario

//     // Generar JWT token
//     const token = jwt.sign({ id: user.id }, "process.env.JWT_SECRET", {
//       expiresIn: '30d',
//     });

//     // Respuesta exitosa con el token y el hostname
//     res.status(200).json({
//       status: 'success',
//       data: { user, token },
//       hostname: hostname,
//     });
//   });
// });


  
//   const opts = {
//     filter: '(objectClass=user)',
//     scope: 'sub',
//     attributes: [
//       'sAMAccountName', 
//       'userPrincipalName',
//       'givenName',
//       'sn',
//       'extensionAttribute3',
//       'company',
//       'department',
//       'extensionAttribute13',
//       'extensionAttribute12',
//       'title'
//     ],
//     paged: {
//       pageSize: 500, // Tamaño de la página (número de entradas por página)
//       pagePause: false // Pausar entre cada página de resultados
//     }
//   };

// routerAut.get('/sincronizar', ()=> {
//   syncUsersFromLDAP()
//   .then(resultado => res.json(resultado))
//   .catch(error => res.status(500).json({ error: error.message }));
// })

// // Función para sincronizar usuarios automáticamente
// const syncUsersFromLDAP = () => {
//   client.bind(process.env.AD_USER, process.env.AD_PASS, (err) => {
//     if (err) {
//       console.error('Error al autenticar en LDAP:', err);
//       return;
//     }

//     const userQueue = [];

//     client.search('OU=cuentas,DC=DIVINF,DC=com', opts, (err, ldapRes) => {
//       if (err) {
//         console.error('Error al buscar en LDAP:', err);
//         return;
//       }

//       ldapRes.on('searchEntry', (entry) => {
//         const ldapUser = entry.pojo.attributes.reduce((acc, attribute) => {
//           acc[attribute.type] = attribute.values[0];
//           return acc;
//         }, {});
//         userQueue.push(ldapUser);
//       });

//       ldapRes.on('end', async () => {
//         console.log(`Total de usuarios encontrados: ${userQueue.length}`);
//         await processQueueWithConcurrency(userQueue, 5); // Cambia 5 por el número de procesos concurrentes
//         console.log('Sincronización finalizada.');
//         client.unbind();
//       });

//       ldapRes.on('error', (err) => {
//         console.error('Error en la búsqueda LDAP:', err);
//         client.unbind();
//       });
//     });
//   });
// };

// async function processQueueWithConcurrency(queue, concurrencyLimit) {
//   let activeProcesses = 0;
//   let currentIndex = 0;

//   return new Promise((resolve, reject) => {
//     const next = () => {
//       if (currentIndex >= queue.length && activeProcesses === 0) {
//         resolve();
//         return;
//       }

//       while (activeProcesses < concurrencyLimit && currentIndex < queue.length) {
//         const ldapUser = queue[currentIndex++];
//         activeProcesses++;

//         processUser(ldapUser)
//           .catch((err) => console.error('Error al procesar usuario:', err))
//           .finally(() => {
//             activeProcesses--;
//             next();
//           });
//       }
//     };

//     next();
//   });
// }

// async function processUser(ldapUser) {
//   if (!ldapUser.sAMAccountName) {
//     console.log(`El usuario sin sAMAccountName fue omitido.`);
//     return;
//   }

//   if (ldapUser.givenName && ldapUser.givenName.startsWith('Caja')) {
//     console.log(`El usuario ${ldapUser.sAMAccountName} ha sido excluido por nombre.`);
//     return;
//   }

//   if (ldapUser.userPrincipalName && ldapUser.userPrincipalName.endsWith('@divinf.com')) {
//     console.log(`El usuario ${ldapUser.sAMAccountName} ha sido excluido por dominio.`);
//     return;
//   }

//   const existingUser = await Usuario.findOne({ where: { usuario: ldapUser.sAMAccountName } });

//   if (existingUser) {
//     console.log(`El usuario ${ldapUser.sAMAccountName} ya existe.`);
//   } else {
//     const newUser = await Usuario.create({
//       usuario: ldapUser.sAMAccountName,
//       correo: ldapUser.userPrincipalName,
//       rol: 'Usuario',
//       nombres: ldapUser.givenName,
//       apellidos: ldapUser.sn,
//       dpi: ldapUser.extensionAttribute12 || "Pendiente",
//       departamento: ldapUser.department || "Pendiente",
//       puesto: ldapUser.title || "Pendiente",
//       codigo: ldapUser.extensionAttribute13 || "Pendiente",
//       vp: ldapUser.extensionAttribute3 || "Pendiente"
//     });

//     console.log(`Usuario ${newUser.usuario} creado correctamente.`);
//   }
// }


// routerAut.get('/profile', (req, res, next) => {
//     res.json('login')

// })


// module.exports = { routerAut, syncUsersFromLDAP }