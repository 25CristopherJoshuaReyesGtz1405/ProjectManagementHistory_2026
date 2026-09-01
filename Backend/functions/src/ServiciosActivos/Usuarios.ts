/**
 * ====================================================================
 * SERVICIO DE USUARIOS (SIGAH) - REFACTORIZADO
 * ====================================================================
 * Administra el control de acceso del personal administrativo.
 * Implementa 2-Phase Commit (Rollback) y Auto-Suspensión Zero-Trust.
 */

import { auth, db } from "../ConfiguracionesActivas/ADBB_BaseDatos_Secundaria.js";
import type { Usuario } from "../ModelosAplicacion/ModelosAplicacion.model.js";
import { registrarLogAvanzado } from "./Auditoria.js";
import { AppError } from "../UtilidadesActivas/AppError.js";
import cron from "node-cron";

const usuariosRef = db.collection("usuarios");

/**
 * CREAR USUARIO ADMINISTRATIVO (Atómico con Rollback)
 */
export const crearUsuarioAdministrativo = async (
  email: string,
  password: string,
  datosUsuario: { nombre: string; rol: string; departamento: string; },
  adminUid: string
): Promise<string> => {
  let nuevoUsuarioUid: string | null = null;

  try {
    const userRecord = await auth.createUser({ email, password, displayName: datosUsuario.nombre });
    nuevoUsuarioUid = userRecord.uid;

    const batch = db.batch();
    const usuarioDocRef = usuariosRef.doc(nuevoUsuarioUid);
    
    const nuevoPerfil = {
      ...datosUsuario,
      uid: nuevoUsuarioUid,
      correo: email,
      estatus: 'ACTIVO',
      trustScore: 100, // Inicia con score perfecto
      metadata: {
        creadoPor: adminUid,
        fechaCreacion: new Date(),
        ultimoAcceso: new Date()
      }
    };
    
    batch.set(usuarioDocRef, nuevoPerfil);
    await batch.commit();

    await registrarLogAvanzado(adminUid, "CREAR_USUARIO_ADMINISTRATIVO", { uidCreado: nuevoUsuarioUid, email } as unknown as string, "USUARIOS", "CREATE", nuevoUsuarioUid, JSON.stringify({ uidCreado: nuevoUsuarioUid, email }));
    return nuevoUsuarioUid;
    
  } catch (error: any) {
    // 2-Phase Commit Rollback: Si Firestore falla, destruimos la credencial en Auth
    if (nuevoUsuarioUid) {
      await auth.deleteUser(nuevoUsuarioUid).catch(err => console.error("Fallo crítico en Rollback Auth:", err));
    }
    throw new AppError(`Fallo en el registro del personal: ${error.message}`, 400);
  }
};

/**
 * SUSPENDER USUARIO (Baja Lógica)
 */
export const suspenderUsuarioAdministrativo = async (uid: string, adminUid: string, motivo: string = "Baja manual"): Promise<void> => {
  try {
    await auth.updateUser(uid, { disabled: true });

    const batch = db.batch();
    batch.update(usuariosRef.doc(uid), { 
      estatus: "BAJA", 
      'metadata.fechaBaja': new Date(),
      'metadata.motivoBaja': motivo
    });
    
    await batch.commit();
    await registrarLogAvanzado(adminUid, "BAJA_USUARIO_ADMINISTRATIVO", { uidBaja: uid, motivo } as unknown as string, "USUARIOS", "DELETE", uid, JSON.stringify({ uidBaja: uid, motivo }));
  } catch (error) {
    throw new AppError("No se pudo revocar el acceso del usuario en la capa de autenticación.", 500);
  }
};

/**
 * OBTENER CATÁLOGO DE PERSONAL
 */
export const obtenerListaAdministrativos = async (): Promise<any[]> => {
  try {
    const snapshot = await usuariosRef.orderBy('metadata.fechaCreacion', 'desc').get();
    return snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
  } catch (error) {
    throw new AppError("No se pudo recuperar el catálogo de personal administrativo.", 500);
  }
};

/**
 * CONSULTAR PERFIL POR UID
 */
export const consultarPerfilUsuario = async (uidRecibido: string): Promise<Usuario> => {
  const doc = await usuariosRef.doc(uidRecibido).get();
  if (!doc.exists) throw new AppError("El perfil del usuario solicitado no existe.", 404);
  return { uid: doc.id, ...doc.data() } as any as Usuario;
};

/**
 * ACTUALIZAR ROLES O DEPARTAMENTOS
 */
export const actualizarPerfilUsuario = async (
  uid: string,
  datosActualizados: { rol?: string; departamento?: string },
  adminUid: string
): Promise<void> => {
  const usuarioDoc = usuariosRef.doc(uid);
  const snap = await usuarioDoc.get();
  
  if (!snap.exists) throw new AppError("El usuario no existe en la base de datos.", 404);

  await usuarioDoc.update({
    ...datosActualizados,
    'metadata.fechaUltimaModificacion': new Date(),
    'metadata.modificadoPor': adminUid
  });

  await registrarLogAvanzado(adminUid, "ACTUALIZAR_PERFIL_ADMINISTRATIVO", datosActualizados as string, "USUARIOS", "UPDATE", uid, JSON.stringify(datosActualizados));
};

/**
 * 🌟 KILLER FEATURE: Autolimpieza de Cuentas Zombis (Zero-Trust)
 * Suspende automáticamente a los usuarios que no han iniciado sesión en 90 días.
 */
export const iniciarAuditoriaCuentasInactivas = () => {
  // Se ejecuta el día 1 de cada mes a las 3:00 AM
  cron.schedule('0 3 1 * *', async () => {
    console.log('[SIGAH - SECURITY] Auditando cuentas inactivas...');
    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() - 90);

    try {
      const snapshot = await usuariosRef
        .where('estatus', '==', 'ACTIVO')
        .where('metadata.ultimoAcceso', '<', fechaLimite)
        .get();

      for (const doc of snapshot.docs) {
        // Suspendemos por inactividad usando la función principal
        await suspenderUsuarioAdministrativo(doc.id, "SISTEMA_AUTOMATICO", "Suspensión automática por inactividad (90 días)");
        console.log(`[SIGAH - SECURITY] Usuario ${doc.id} suspendido por inactividad.`);
      }
    } catch (error) {
      console.error('[SIGAH - SECURITY] Error auditando cuentas:', error);
    }
  });
};