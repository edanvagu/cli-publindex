import * as XLSX from 'xlsx-js-style';
import * as path from 'path';
import { HEADERS_EXCEL, TIPOS_DOCUMENTO, TIPOS_RESUMEN, TIPOS_ESPECIALISTA, IDIOMAS, COLUMNAS_ESTADO } from '../config/constants';
import { AREAS_TREE } from './areas';
import { ArticuloRow } from './types';

const CAMPOS_OBLIGATORIOS = ['titulo', 'url', 'gran_area', 'area', 'tipo_documento', 'palabras_clave', 'titulo_ingles', 'resumen'];
const FILL_ALERTA = { patternType: 'solid', fgColor: { rgb: 'FFEB9C' } };

const EJEMPLO_ARTICULO: Partial<ArticuloRow> = {
  titulo: 'Título del artículo de ejemplo para Publindex',
  doi: '10.1234/ejemplo-articulo',
  url: 'https://revistas.ejemplo.edu.co/articulo/1',
  pagina_inicial: '1',
  pagina_final: '15',
  numero_autores: '3',
  numero_pares_evaluadores: '2',
  gran_area: '5',
  area: '5D',
  subarea: '5D01',
  numero_referencias: '30',
  tipo_documento: '1',
  palabras_clave: 'sociología; cultura; América Latina',
  palabras_clave_otro_idioma: 'sociology; culture; Latin America',
  titulo_ingles: 'Title of the example article for Publindex',
  fecha_recepcion: '2026-01-15',
  fecha_aceptacion: '2026-03-20',
  idioma: 'ES',
  otro_idioma: 'EN',
  eval_interna: 'F',
  eval_nacional: 'T',
  eval_internacional: 'T',
  tipo_resumen: 'A',
  tipo_especialista: 'S',
  resumen: 'Resumen del artículo de ejemplo con más de diez caracteres.',
  resumen_otro_idioma: 'Abstract of the example article with more than ten characters.',
};

export function generarPlantilla(outputDir: string = '.'): string {
  return generarPlantillaConDatos([EJEMPLO_ARTICULO], path.join(outputDir, 'plantilla-articulos.xlsx'));
}

export function generarPlantillaConDatos(articulos: Partial<ArticuloRow>[], outputPath: string): string {
  const wb = XLSX.utils.book_new();

  const headers = [
    ...HEADERS_EXCEL,
    COLUMNAS_ESTADO.ESTADO,
    COLUMNAS_ESTADO.FECHA_SUBIDA,
    COLUMNAS_ESTADO.ULTIMO_ERROR,
  ];

  const filas = articulos.map(art => headers.map(h => (art as Record<string, unknown>)[h] ?? ''));

  const wsArticulos = XLSX.utils.aoa_to_sheet([headers, ...filas]);
  wsArticulos['!cols'] = headers.map(h => ({ wch: Math.max(h.length + 2, 18) }));
  resaltarObligatoriosVacios(wsArticulos, headers, filas);
  XLSX.utils.book_append_sheet(wb, wsArticulos, 'Artículos');

  XLSX.utils.book_append_sheet(wb, construirHojaInstrucciones(), 'Instrucciones');
  XLSX.utils.book_append_sheet(wb, construirHojaAreas(), 'Áreas');
  XLSX.utils.book_append_sheet(wb, construirHojaTipos(), 'Tipos y códigos');

  XLSX.writeFile(wb, outputPath);
  console.log(`\n  ✓ Plantilla generada: ${outputPath}\n`);
  return outputPath;
}

function resaltarObligatoriosVacios(ws: XLSX.WorkSheet, headers: string[], filas: unknown[][]): void {
  const indicesObligatorios = headers
    .map((h, i) => CAMPOS_OBLIGATORIOS.includes(h) ? i : -1)
    .filter(i => i >= 0);

  filas.forEach((fila, filaIdx) => {
    for (const colIdx of indicesObligatorios) {
      const valor = fila[colIdx];
      if (valor !== '' && valor !== undefined && valor !== null) continue;
      const addr = XLSX.utils.encode_cell({ r: filaIdx + 1, c: colIdx });
      if (!ws[addr]) ws[addr] = { t: 's', v: '' };
      ws[addr].s = { fill: FILL_ALERTA };
    }
  });
}

function construirHojaInstrucciones(): XLSX.WorkSheet {
  const instrucciones = [
    ['Campo', 'Obligatorio', 'Descripción', 'Ejemplo'],
    ['titulo', 'Sí', 'Título del artículo (mínimo 10 caracteres)', 'Título del artículo de ejemplo para Publindex'],
    ['doi', 'No', 'DOI del artículo SIN URL (formato: 10.xxxx/yyyy). NO use https://doi.org/...', '10.1234/abc'],
    ['url', 'Sí', 'URL del artículo con http:// o https://', 'https://url.com/article'],
    ['pagina_inicial', 'No', 'Número de página inicial', '1'],
    ['pagina_final', 'No', 'Número de página final (debe ser mayor que pagina_inicial)', '15'],
    ['numero_autores', 'No', 'Cantidad de autores del artículo', '3'],
    ['numero_pares_evaluadores', 'No', 'Cantidad de pares que evaluaron el artículo', '2'],
    ['proyecto', 'No', 'Nombre del proyecto de investigación asociado', ''],
    ['gran_area', 'Sí', 'Código de la gran área de conocimiento (ver hoja Áreas)', '5'],
    ['area', 'Sí', 'Código del área de conocimiento (debe pertenecer a la gran_area)', '5D'],
    ['subarea', 'No', 'Código de la subárea (debe pertenecer al area)', '5D01'],
    ['numero_referencias', 'No', 'Cantidad de referencias bibliográficas', '30'],
    ['tipo_documento', 'Sí', 'Código del tipo de documento (ver hoja Tipos documento)', '1'],
    ['palabras_clave', 'Sí', 'Palabras clave separadas por punto y coma (;)', 'sociología; cultura'],
    ['palabras_clave_otro_idioma', 'No', 'Palabras clave en otro idioma, separadas por ;', 'sociology; culture'],
    ['titulo_ingles', 'Sí', 'Título del artículo en inglés (mínimo 10 caracteres)', 'Title of the article in English (minimum 10 characters)'],
    ['fecha_recepcion', 'No', 'Fecha de recepción formato YYYY-MM-DD', '2026-01-15'],
    ['fecha_aceptacion', 'No', 'Fecha de aceptación (debe ser >= fecha_recepcion)', '2026-03-20'],
    ['idioma', 'No', 'Código del idioma original: ES, EN, PT, FR', 'ES'],
    ['otro_idioma', 'No', 'Código de otro idioma (no puede ser igual a idioma)', 'EN'],
    ['eval_interna', 'No', 'Evaluación por pares interna institucional: T=Sí, F=No', 'F'],
    ['eval_nacional', 'No', 'Evaluación por pares externos nacionales: T=Sí, F=No', 'T'],
    ['eval_internacional', 'No', 'Evaluación por pares externos internacionales: T=Sí, F=No', 'T'],
    ['tipo_resumen', 'No', 'A=Analítico, D=Descriptivo, S=Analítico sintético', 'A'],
    ['tipo_especialista', 'No', 'A=Autor, E=Editor, B=Bibliotecólogo, S=Especialista', 'S'],
    ['resumen', 'Sí', 'Resumen del artículo (mínimo 10 caracteres)', 'Resumen del artículo...'],
    ['resumen_otro_idioma', 'No', 'Resumen en segundo idioma', 'Abstract of the article...'],
    ['resumen_idioma_adicional', 'No', 'Resumen en tercer idioma', ''],
    ['', '', '', ''],
    ['Columnas de estado (NO EDITAR - son automáticas)', '', '', ''],
    ['estado', 'Auto', 'Se llena automáticamente: pendiente, subido o error', 'subido'],
    ['fecha_subida', 'Auto', 'Fecha/hora en que el artículo se cargó exitosamente', '2026-04-19T10:30:00.000Z'],
    ['ultimo_error', 'Auto', 'Mensaje de error si la carga falló', ''],
  ];

  const ws = XLSX.utils.aoa_to_sheet(instrucciones);
  ws['!cols'] = [{ wch: 30 }, { wch: 12 }, { wch: 55 }, { wch: 40 }];
  return ws;
}

function construirHojaAreas(): XLSX.WorkSheet {
  const areasData: string[][] = [['Código gran área', 'Gran área', 'Código área', 'Área', 'Código subárea', 'Subárea']];

  for (const granArea of AREAS_TREE) {
    if (!granArea.areasHijas) continue;
    for (const area of granArea.areasHijas) {
      if (!area.areasHijas) continue;
      for (const subarea of area.areasHijas) {
        areasData.push([
          granArea.codAreaConocimiento,
          granArea.txtNmeArea,
          area.codAreaConocimiento,
          area.txtNmeArea,
          subarea.codAreaConocimiento,
          subarea.txtNmeArea,
        ]);
      }
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(areasData);
  ws['!cols'] = [{ wch: 16 }, { wch: 30 }, { wch: 14 }, { wch: 45 }, { wch: 16 }, { wch: 50 }];
  return ws;
}

function construirHojaTipos(): XLSX.WorkSheet {
  const tiposData: string[][] = [['Código', 'Tipo de documento']];
  for (const [codigo, nombre] of Object.entries(TIPOS_DOCUMENTO)) {
    tiposData.push([codigo, nombre]);
  }
  tiposData.push(['', '']);
  tiposData.push(['', 'TIPO RESUMEN']);
  tiposData.push(['Código', 'Tipo']);
  for (const [codigo, nombre] of Object.entries(TIPOS_RESUMEN)) {
    tiposData.push([codigo, nombre]);
  }
  tiposData.push(['', '']);
  tiposData.push(['', 'TIPO ESPECIALISTA']);
  tiposData.push(['Código', 'Tipo']);
  for (const [codigo, nombre] of Object.entries(TIPOS_ESPECIALISTA)) {
    tiposData.push([codigo, nombre]);
  }
  tiposData.push(['', '']);
  tiposData.push(['', 'IDIOMAS']);
  tiposData.push(['Código', 'Idioma']);
  for (const [codigo, nombre] of Object.entries(IDIOMAS)) {
    tiposData.push([codigo, nombre]);
  }

  const ws = XLSX.utils.aoa_to_sheet(tiposData);
  ws['!cols'] = [{ wch: 10 }, { wch: 55 }];
  return ws;
}
