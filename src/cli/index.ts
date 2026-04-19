import { banner, spinner, exito, error, info, advertencia, mostrarValidacion, mostrarProgreso, mostrarResumen, mostrarPausa } from './logger';
import { pedirCredenciales, seleccionarFasciculo, pedirArchivo, confirmarContinuar, menuPrincipal, confirmarReanudar, confirmarEstimadoTiempo } from './prompts';
import { login, tokenVigente } from '../api/auth';
import { listarFasciculos, formatFasciculo } from '../api/fasciculos';
import { readArticulos, ReadResult } from '../data/reader';
import { validarLote } from '../data/validator';
import { ejecutarCarga, estimarTiempoSegundos } from '../pipeline/runner';
import { GestorProgreso } from '../data/progreso';
import { generarPlantilla } from '../data/template';
import { Session, ArticuloRow, ValidationResult, ModoEjecucion } from '../data/types';

export async function run(options: { modoForzado?: ModoEjecucion } = {}) {
  banner();

  // 1. Menú principal
  const modo = options.modoForzado ?? await menuPrincipal();

  if (modo === 'salir') {
    info('Hasta luego.');
    return;
  }

  if (modo === 'plantilla') {
    generarPlantilla();
    return;
  }

  // 2. Pedir archivo (común a validar y cargar)
  const archivo = await pedirArchivo();

  // 3. Leer el archivo y detectar estado previo
  const readSpinner = spinner(`Leyendo ${archivo}...`);
  let readResult: ReadResult;
  try {
    readResult = readArticulos(archivo);
    readSpinner.succeed(`${readResult.articulos.length} artículos leídos`);
  } catch (err) {
    readSpinner.fail('Error al leer archivo');
    error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  // 4. Detectar progreso previo
  let articulosAProcesar: ArticuloRow[] = readResult.articulos;

  if (readResult.yaSubidos.length > 0) {
    info(`Se detectaron ${readResult.yaSubidos.length} artículos ya cargados previamente.`);
    if (modo === 'cargar') {
      const accion = await confirmarReanudar(readResult.yaSubidos.length, readResult.pendientes.length + readResult.conError.length);
      if (accion === 'omitir') {
        articulosAProcesar = [...readResult.pendientes, ...readResult.conError];
        info(`Se procesarán los ${articulosAProcesar.length} artículos pendientes + con error.`);
      } else {
        advertencia('Se procesarán TODOS los artículos, incluyendo los ya cargados.');
      }
    } else {
      info('Modo solo validar: se validarán todos los artículos.');
    }
  }

  // 5. Validación completa (siempre sobre los artículos a procesar)
  const validacion = validarLote(articulosAProcesar, readResult.headersDesconocidos);
  mostrarValidacion(validacion);

  if (validacion.validos.length === 0) {
    error('No hay artículos válidos.');
    process.exit(1);
  }

  // 6. Si es modo "solo validar", terminar aquí
  if (modo === 'validar') {
    exito('Validación completada.');
    if (validacion.errores.length > 0) {
      info(`Corrija los ${new Set(validacion.errores.map(e => e.fila)).size} errores antes de cargar.`);
    } else {
      info('Todo listo para cargar. Ejecute de nuevo y seleccione "Validar y cargar artículos".');
    }
    return;
  }

  // 7. Modo "cargar": confirmar si hay errores parciales
  if (validacion.errores.length > 0) {
    const continuar = await confirmarContinuar(
      `¿Continuar con los ${validacion.validos.length} artículos válidos?`
    );
    if (!continuar) {
      info('Operación cancelada. Corrija los errores y vuelva a intentar.');
      return;
    }
  }

  // 8. Credenciales
  const { usuario, contrasena } = await pedirCredenciales();

  // 9. Login
  const loginSpinner = spinner('Iniciando sesión...');
  let session: Session;
  try {
    session = await login(usuario, contrasena);
    loginSpinner.succeed(`Sesión iniciada: ${session.nmeRevista}`);
  } catch (err) {
    loginSpinner.fail('Login fallido');
    error(err instanceof Error ? err.message : String(err));
    error('Verifique sus credenciales. NO se reintentará para evitar bloqueo de cuenta.');
    process.exit(1);
  }

  // 10. Listar fascículos
  const fascSpinner = spinner('Obteniendo fascículos...');
  let fasciculos;
  try {
    fasciculos = await listarFasciculos(session.token);
    fascSpinner.succeed(`${fasciculos.length} fascículos encontrados`);
  } catch (err) {
    fascSpinner.fail('Error al obtener fascículos');
    error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  if (fasciculos.length === 0) {
    error('No se encontraron fascículos en esta revista.');
    process.exit(1);
  }

  // 11. Seleccionar fascículo
  const fasciculo = await seleccionarFasciculo(fasciculos);
  exito(`Fascículo seleccionado: ${formatFasciculo(fasciculo)} (ID: ${fasciculo.id})`);

  // 12. Estimado de tiempo
  const tiempoEstimado = estimarTiempoSegundos(validacion.validos.length);
  const procederCarga = await confirmarEstimadoTiempo(validacion.validos.length, tiempoEstimado);
  if (!procederCarga) {
    info('Operación cancelada.');
    return;
  }

  // 13. Verificar token
  if (!tokenVigente(session)) {
    advertencia('El token de sesión está próximo a expirar. Considere reiniciar el proceso.');
  }

  // 14. Carga secuencial
  info(`Iniciando carga de ${validacion.validos.length} artículos...`);
  console.log('');

  const gestorProgreso = new GestorProgreso(archivo);

  const resultado = await ejecutarCarga(session, validacion.validos, fasciculo.id, {
    gestorProgreso,
    onProgress: mostrarProgreso,
    onPausa: (seg) => mostrarPausa(seg),
    onRetry: (fila, intento, err) => {
      advertencia(`Fila ${fila}: intento ${intento} falló (${err.message}). Reintentando...`);
    },
    onTokenExpiring: () => {
      advertencia('Token próximo a expirar. Los próximos requests podrían fallar.');
    },
    onAdvertencia: (msg) => {
      advertencia(msg);
    },
  });

  // 15. Intentar sincronizar sidecar si existe
  gestorProgreso.intentarSincronizarSidecar();

  // 16. Resumen
  mostrarResumen(resultado);

  // 17. Reintentar fallidos
  if (resultado.fallidos.length > 0) {
    const reintentar = await confirmarContinuar('¿Reintentar los artículos fallidos?');
    if (reintentar) {
      const filasFallidas = new Set(resultado.fallidos.map(f => f.fila));
      const articulosRetry = validacion.validos.filter(a => filasFallidas.has(a._fila));

      info(`Reintentando ${articulosRetry.length} artículos...`);
      console.log('');

      const resultadoRetry = await ejecutarCarga(session, articulosRetry, fasciculo.id, {
        gestorProgreso,
        onProgress: mostrarProgreso,
        onPausa: (seg) => mostrarPausa(seg),
        onRetry: (fila, intento, err) => {
          advertencia(`Fila ${fila}: reintento ${intento} (${err.message})`);
        },
        onTokenExpiring: () => {
          advertencia('Token próximo a expirar.');
        },
        onAdvertencia: (msg) => {
          advertencia(msg);
        },
      });

      gestorProgreso.intentarSincronizarSidecar();
      mostrarResumen(resultadoRetry);
    }
  }

  exito('Proceso finalizado.');
}
