import { banner, spinner, exito, error, info, advertencia, mostrarValidacion, mostrarProgreso, mostrarResumen, mostrarPausa, mostrarTiempoRestante } from './logger';
import { pedirCredenciales, seleccionarFasciculo, pedirArchivo, pedirArchivoOjs, pedirUrlBaseRevista, pedirRutaGuardado, confirmarContinuar, menuPrincipal, confirmarReanudar, confirmarEstimadoTiempo } from './prompts';
import { construirUrlArticulo } from '../utils/urls';
import { probarUrl } from '../utils/http';
import { importarDesdeOjs, ojsArticuloToRow, OjsArticulo } from '../data/ojs-importer';
import { login, tokenVigente } from '../api/auth';
import { listarFasciculos, formatFasciculo } from '../api/fasciculos';
import { readArticulos, ReadResult } from '../data/reader';
import { validarLote } from '../data/validator';
import { ejecutarCarga, estimarTiempoSegundos } from '../pipeline/runner';
import { GestorProgreso } from '../data/progreso';
import { generarPlantilla, generarPlantillaConDatos } from '../data/template';
import * as path from 'path';
import { Session, ArticuloRow, ModoEjecucion } from '../data/types';

const NOMBRE_PLANTILLA_OJS = 'plantilla-articulos-ojs.xlsx';

export async function run(options: { modoForzado?: ModoEjecucion } = {}) {
  banner();

  const modo = options.modoForzado ?? await menuPrincipal();

  if (modo === 'salir') {
    info('Hasta luego.');
    return;
  }

  if (modo === 'plantilla') {
    generarPlantilla();
    return;
  }

  if (modo === 'importar-ojs') {
    await importarOjs();
    return;
  }

  const archivo = await pedirArchivo();

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

  const validacion = validarLote(articulosAProcesar, readResult.headersDesconocidos);
  mostrarValidacion(validacion);

  if (validacion.validos.length === 0) {
    error('No hay artículos válidos.');
    process.exit(1);
  }

  if (modo === 'validar') {
    exito('Validación completada.');
    if (validacion.errores.length > 0) {
      info(`Corrija los ${new Set(validacion.errores.map(e => e.fila)).size} errores antes de cargar.`);
    } else {
      info('Todo listo para cargar. Ejecute de nuevo y seleccione "Validar y cargar artículos".');
    }
    return;
  }

  if (validacion.errores.length > 0) {
    const continuar = await confirmarContinuar(
      `¿Continuar con los ${validacion.validos.length} artículos válidos?`
    );
    if (!continuar) {
      info('Operación cancelada. Corrija los errores y vuelva a intentar.');
      return;
    }
  }

  const { usuario, contrasena } = await pedirCredenciales();

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

  const fasciculo = await seleccionarFasciculo(fasciculos);
  exito(`Fascículo seleccionado: ${formatFasciculo(fasciculo)} (ID: ${fasciculo.id})`);

  const tiempoEstimado = estimarTiempoSegundos(validacion.validos.length);
  const procederCarga = await confirmarEstimadoTiempo(validacion.validos.length, tiempoEstimado);
  if (!procederCarga) {
    info('Operación cancelada.');
    return;
  }

  if (!tokenVigente(session)) {
    advertencia('El token de sesión está próximo a expirar. Considere reiniciar el proceso.');
  }

  info(`Iniciando carga de ${validacion.validos.length} artículos...`);
  console.log('');

  const gestorProgreso = new GestorProgreso(archivo);

  const resultado = await ejecutarCarga(session, validacion.validos, fasciculo.id, construirOpcionesCarga(gestorProgreso, false));
  gestorProgreso.intentarSincronizarSidecar();
  mostrarResumen(resultado);

  if (resultado.fallidos.length > 0) {
    const reintentar = await confirmarContinuar('¿Reintentar los artículos fallidos?');
    if (reintentar) {
      const filasFallidas = new Set(resultado.fallidos.map(f => f.fila));
      const articulosRetry = validacion.validos.filter(a => filasFallidas.has(a._fila));

      info(`Reintentando ${articulosRetry.length} artículos...`);
      console.log('');

      const resultadoRetry = await ejecutarCarga(session, articulosRetry, fasciculo.id, construirOpcionesCarga(gestorProgreso, true));
      gestorProgreso.intentarSincronizarSidecar();
      mostrarResumen(resultadoRetry);
    }
  }

  exito('Proceso finalizado.');
}

async function importarOjs() {
  const archivo = await pedirArchivoOjs();
  const parseSpinner = spinner(`Parseando ${path.basename(archivo)}...`);
  let articulos: OjsArticulo[];
  let advertencias: string[];
  try {
    const resultado = await importarDesdeOjs(archivo);
    articulos = resultado.articulos;
    advertencias = resultado.advertencias;
    parseSpinner.succeed(`${articulos.length} publicaciones extraídas desde OJS`);
  } catch (err) {
    parseSpinner.fail('Error al parsear el XML de OJS');
    error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  if (articulos.length === 0) {
    error('No se encontraron publicaciones en el XML. Verifique que sea un export válido de OJS.');
    process.exit(1);
  }

  const urlBase = await pedirUrlBaseRevista();
  const urlsPorIndice = new Map<number, string>();
  const urlAdvertencias: string[] = [];

  if (urlBase) {
    const conId = articulos
      .map((art, idx) => ({ art, idx }))
      .filter(({ art }) => art.submissionId);

    if (conId.length === 0) {
      advertencia('Ningún artículo tiene submissionId; no se construirán URLs.');
    } else {
      const verifySpinner = spinner(`Construyendo y verificando ${conId.length} URLs...`);
      const resultados = await Promise.all(
        conId.map(async ({ art, idx }) => {
          const url = construirUrlArticulo(urlBase, art.submissionId!);
          const resultado = await probarUrl(url);
          return { idx, url, resultado };
        })
      );
      const okCount = resultados.filter(r => r.resultado.ok).length;
      verifySpinner.succeed(`${okCount}/${resultados.length} URLs respondieron 200`);

      for (const { idx, url, resultado } of resultados) {
        urlsPorIndice.set(idx, url);
        if (!resultado.ok) {
          const detalle = resultado.status ? `status ${resultado.status}` : resultado.error ?? 'sin respuesta';
          urlAdvertencias.push(`Fila ${idx + 2}: URL ${url} no respondió 200 (${detalle}).`);
        }
      }
    }
  } else {
    info('URL base no proporcionada; las URLs quedarán vacías para llenar manualmente.');
  }

  const rows = articulos.map((art, idx) => ojsArticuloToRow(art, urlsPorIndice.get(idx)));

  const outputPath = await pedirRutaGuardado(path.dirname(archivo), NOMBRE_PLANTILLA_OJS);
  try {
    generarPlantillaConDatos(rows, outputPath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'EBUSY') {
      error(`No se pudo escribir ${path.basename(outputPath)} porque está abierto en Excel.`);
      info('Cierre el archivo y vuelva a ejecutar "Importar desde OJS".');
      process.exit(1);
    }
    throw err;
  }
  exito(`Plantilla prellena generada con ${rows.length} artículos en ${outputPath}.`);

  if (advertencias.length > 0) {
    console.log('');
    advertencia(`${advertencias.length} artículos con paginación no estándar (posibles e-locators de publicación continua):`);
    for (const a of advertencias) advertencia(`  ${a}`);
  }

  if (urlAdvertencias.length > 0) {
    console.log('');
    advertencia(`${urlAdvertencias.length} URLs no respondieron 200 (quedaron en la plantilla, pero revise antes de cargar):`);
    for (const a of urlAdvertencias) advertencia(`  ${a}`);
  }

  console.log('');
  advertencia('Las celdas resaltadas en AMARILLO son campos obligatorios que quedaron vacíos — debe completarlos antes de validar.');
  info('Abra la plantilla en Excel, complete los campos amarillos, luego ejecute de nuevo la CLI y seleccione "Validar archivo de artículos".');
}

function construirOpcionesCarga(gestorProgreso: GestorProgreso, esRetry: boolean) {
  return {
    gestorProgreso,
    onProgress: mostrarProgreso,
    onPausa: mostrarPausa,
    onTiempoRestante: mostrarTiempoRestante,
    onRetry: (fila: number, intento: number, err: Error) => {
      const etiqueta = esRetry ? 'reintento' : 'intento';
      const sufijo = esRetry ? '' : ' falló. Reintentando...';
      advertencia(`Fila ${fila}: ${etiqueta} ${intento} (${err.message})${sufijo}`);
    },
    onTokenExpiring: () => {
      advertencia('Token próximo a expirar. Los próximos requests podrían fallar.');
    },
    onAdvertencia: advertencia,
  };
}
