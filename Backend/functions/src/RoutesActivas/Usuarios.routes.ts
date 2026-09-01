import { Router, type Request, type Response, type NextFunction } from 'express';
import * as ServicioUsuarios from '../ServiciosActivos/Usuarios.js';
import authMiddleware from '../APIs/auth.middleware.js';
import { validate } from '../APIs/validate.middlware.js';
import { UsuarioSchema, UsuarioUpdateSchema } from '../ValidacionesActivas/Usuarios.schema.js';

const router = Router();
router.use(authMiddleware);

router.post("/administrativo", validate(UsuarioSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, nombre, rol, departamento } = req.body;
    const adminUid = (req as any).user.uid; 
    const datosUsuario = { nombre, rol, departamento };
    
    const nuevoUid = await ServicioUsuarios.crearUsuarioAdministrativo(email, password, datosUsuario, /*adminUid*/'any');
    
    res.status(201).json({
      status: 'success',
      message: "Personal administrativo registrado y autenticación configurada.",
      uid: nuevoUid,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/administrativos", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const listaUsuarios = await ServicioUsuarios.obtenerListaAdministrativos();
    res.status(200).json(listaUsuarios);
  } catch (error) {
    next(error);
  }
});

router.get("/administrativos/:uid", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { uid } = req.params;
    const usuario = await ServicioUsuarios.consultarPerfilUsuario(uid as string);
    res.status(200).json(usuario);
  } catch (error) {
    next(error);
  }
});

router.put("/:uid/datos", validate(UsuarioUpdateSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { uid } = req.params;
    const adminUid = (req as any).user.uid;
    
    await ServicioUsuarios.actualizarPerfilUsuario(uid as string, req.body, adminUid);
    
    res.status(200).json({
      status: 'success',
      message: "Privilegios y departamento actualizados exitosamente.",
    });
  } catch (error) {
    next(error);
  }
});

router.patch("/:uid/suspender", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { uid } = req.params;
    const adminUid = (req as any).user.uid;
    
    await ServicioUsuarios.suspenderUsuarioAdministrativo(uid as string, adminUid);
    
    res.status(200).json({
      status: 'success',
      message: "Acceso revocado de Firebase Auth y dado de baja lógicamente.",
    });
  } catch (error) {
    next(error);
  }
});

export default router;