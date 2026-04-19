import * as XLSX from 'xlsx';
import * as path from 'path';
import { HEADERS_EXCEL, TIPOS_DOCUMENTO, TIPOS_RESUMEN, TIPOS_ESPECIALISTA, IDIOMAS, COLUMNAS_ESTADO } from '../config/constants';
import { AREAS_TREE } from './areas';

export function generarPlantilla(outputDir: string = '.') {
  const wb = XLSX.utils.book_new();

  // === Hoja 1: Artículos (headers + fila de ejemplo + columnas de estado) ===
  const headers = [
    ...HEADERS_EXCEL,
    COLUMNAS_ESTADO.ESTADO,
    COLUMNAS_ESTADO.FECHA_SUBIDA,
    COLUMNAS_ESTADO.ULTIMO_ERROR,
  ];
  const ejemplo = [
    'Título del artículo de ejemplo para Publindex',     // titulo
    'https://doi.org/10.1234/ejemplo',                    // doi
    'https://revistas.ejemplo.edu.co/articulo/1',         // url
    '1',                                                  // pagina_inicial
    '15',                                                 // pagina_final
    '3',                                                  // numero_autores
    '2',                                                  // numero_pares_evaluadores
    '',                                                   // proyecto
    '5',                                                  // gran_area (Ciencias Sociales)
    '5D',                                                 // area (Sociología)
    '5D01',                                               // subarea (Sociología)
    '30',                                                 // numero_referencias
    '1',                                                  // tipo_documento
    'sociología; cultura; América Latina',                // palabras_clave
    'sociology; culture; Latin America',                  // palabras_clave_otro_idioma
    'Title of the example article for Publindex',         // titulo_ingles
    '2026-01-15',                                         // fecha_recepcion
    '2026-03-20',                                         // fecha_aceptacion
    'ES',                                                 // idioma
    'EN',                                                 // otro_idioma
    'F',                                                  // eval_interna
    'T',                                                  // eval_nacional
    'T',                                                  // eval_internacional
    'A',                                                  // tipo_resumen
    'S',                                                  // tipo_especialista
    'Resumen del artículo de ejemplo con más de diez caracteres.',  // resumen
    'Abstract of the example article with more than ten characters.', // resumen_otro_idioma
    '',                                                   // resumen_idioma_adicional
    '',                                                   // estado (se llena automáticamente)
    '',                                                   // fecha_subida
    '',                                                   // ultimo_error
  ];

  const articulosData = [headers, ejemplo];
  const wsArticulos = XLSX.utils.aoa_to_sheet(articulosData);

  // Ancho de columnas
  wsArticulos['!cols'] = headers.map(h => ({ wch: Math.max(h.length + 2, 18) }));

  XLSX.utils.book_append_sheet(wb, wsArticulos, 'Artículos');

  // === Hoja 2: Instrucciones ===
  const instrucciones = [
    ['Campo', 'Obligatorio', 'Descripción', 'Ejemplo'],
    ['titulo', 'Sí', 'Título del artículo (mínimo 10 caracteres)', 'Título del artículo de ejemplo para Publindex'],
    ['doi', 'No', 'DOI del artículo (mínimo 10 caracteres si se incluye)', '10.1234/abc'],
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

  const wsInstrucciones = XLSX.utils.aoa_to_sheet(instrucciones);
  wsInstrucciones['!cols'] = [{ wch: 30 }, { wch: 12 }, { wch: 55 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, wsInstrucciones, 'Instrucciones');

  // === Hoja 3: Áreas de conocimiento ===
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

  const wsAreas = XLSX.utils.aoa_to_sheet(areasData);
  wsAreas['!cols'] = [{ wch: 16 }, { wch: 30 }, { wch: 14 }, { wch: 45 }, { wch: 16 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(wb, wsAreas, 'Áreas');

  // === Hoja 4: Tipos de documento ===
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

  const wsTipos = XLSX.utils.aoa_to_sheet(tiposData);
  wsTipos['!cols'] = [{ wch: 10 }, { wch: 55 }];
  XLSX.utils.book_append_sheet(wb, wsTipos, 'Tipos y códigos');

  // Escribir archivo
  const outputPath = path.join(outputDir, 'plantilla-articulos.xlsx');
  XLSX.writeFile(wb, outputPath);

  console.log(`\n  ✓ Plantilla generada: ${outputPath}\n`);
}
