import { banner, spinner, exito, error, info, advertencia, mostrarValidacion, mostrarProgreso, mostrarResumen } from './logger';
import { pedirCredenciales, seleccionarFasciculo, pedirArchivo, confirmarContinuar } from './prompts';
import { login, tokenVigente } from '../api/auth';
import { listarFasciculos, formatFasciculo } from '../api/fasciculos';
import { readArticulos } from '../data/reader';
import { validarLote } from '../data/validator';
import { ejecutarCarga } from '../pipeline/runner';
import { Session } from '../data/types';

export async function run(options: { dryRun?: boolean; concurrency?: number }) {
  banner();

  // 1. Seleccionar y validar archivo PRIMERO (antes de login)
  const archivo = await pedirArchivo();
  const readSpinner = spinner(`Leyendo ${archivo}...`);
  let readResult;
  try {
    readResult = readArticulos(archivo);
    readSpinner.succeed(`${readResult.articulos.length} artículos leídos`);
  } catch (err) {
    readSpinner.fail('Error al leer archivo');
    error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  // 2. Validación por lote
  const validacion = validarLote(readResult.articulos, readResult.headersDesconocidos);
  mostrarValidacion(validacion);

  if (validacion.validos.length === 0) {
    error('No hay artículos válidos para cargar.');
    process.exit(1);
  }

  // Modo dry-run: terminar aquí (sin login)
  if (options.dryRun) {
    info('Modo --dry-run: validación completada, no se enviarán datos.');
    process.exit(0);
  }

  // 3. Confirmar si hay errores parciales
  if (validacion.errores.length > 0) {
    const continuar = await confirmarContinuar(
      `¿Continuar con los ${validacion.validos.length} artículos válidos?`
    );
    if (!continuar) {
      info('Operación cancelada. Corrija los errores y vuelva a intentar.');
      process.exit(0);
    }
  }

  // 4. Credenciales (solo después de validar datos)
  const { usuario, contrasena } = await pedirCredenciales();

  // 5. Login (UN solo intento)
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

  // 6. Listar fascículos
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

  // 7. Seleccionar fascículo
  const fasciculo = await seleccionarFasciculo(fasciculos);
  exito(`Fascículo seleccionado: ${formatFasciculo(fasciculo)} (ID: ${fasciculo.id})`);

  // 8. Verificar token
  if (!tokenVigente(session)) {
    advertencia('El token de sesión está próximo a expirar. Considere reiniciar el proceso.');
  }

  // 9. Carga masiva
  const concurrency = options.concurrency || 1;
  info(`Iniciando carga de ${validacion.validos.length} artículos (concurrencia: ${concurrency})...`);
  console.log('');

  const resultado = await ejecutarCarga(session, validacion.validos, fasciculo.id, {
    concurrency,
    onProgress: mostrarProgreso,
    onRetry: (fila, intento, err) => {
      advertencia(`Fila ${fila}: intento ${intento} falló (${err.message}). Reintentando...`);
    },
    onTokenExpiring: () => {
      advertencia('Token próximo a expirar. Los próximos requests podrían fallar.');
    },
  });

  // 10. Resumen
  mostrarResumen(resultado);

  // 11. Reintentar fallidos
  if (resultado.fallidos.length > 0) {
    const reintentar = await confirmarContinuar('¿Reintentar los artículos fallidos?');
    if (reintentar) {
      const filasAFallidas = new Set(resultado.fallidos.map(f => f.fila));
      const articulosRetry = validacion.validos.filter(a => filasAFallidas.has(a._fila));

      info(`Reintentando ${articulosRetry.length} artículos...`);
      console.log('');

      const resultadoRetry = await ejecutarCarga(session, articulosRetry, fasciculo.id, {
        concurrency: 1,
        onProgress: mostrarProgreso,
        onRetry: (fila, intento, err) => {
          advertencia(`Fila ${fila}: reintento ${intento} (${err.message})`);
        },
        onTokenExpiring: () => {
          advertencia('Token próximo a expirar.');
        },
      });

      mostrarResumen(resultadoRetry);
    }
  }

  exito('Proceso finalizado.');
}
