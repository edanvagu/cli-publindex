import { z } from 'zod';
import { DOCUMENT_TYPES, LANGUAGES, SUMMARY_TYPES, SPECIALIST_TYPES } from '../../config/constants';
import { areaExists, areaBelongsToParent, subareaBelongsToArea } from '../areas/tree';
import {
  FieldConstraint,
  FIELD_CONSTRAINTS,
  REQUIRED_FIELDS_BY_DOC_TYPE,
  DocTypeCode,
} from '../../config/article-form-rules';
import { assertPayload } from '../../utils/payload-validator';

const docTypeCodes = Object.keys(DOCUMENT_TYPES) as [DocTypeCode, ...DocTypeCode[]];
const langCodes = Object.keys(LANGUAGES) as [string, ...string[]];
const summaryCodes = Object.keys(SUMMARY_TYPES) as [string, ...string[]];
const specialistCodes = Object.keys(SPECIALIST_TYPES) as [string, ...string[]];

const tfNullable = z.enum(['T', 'F']).nullable();

function intStringFromConstraint(c: FieldConstraint) {
  return z
    .string()
    .regex(/^-?\d+$/, 'debe ser un entero en formato string')
    .refine(
      (s) => {
        const n = parseInt(s, 10);
        if (Number.isNaN(n)) return false;
        if (c.min !== undefined && n < c.min) return false;
        if (c.max !== undefined && n > c.max) return false;
        return true;
      },
      { message: `debe estar en rango [${c.min ?? '-∞'}, ${c.max ?? '∞'}]` },
    )
    .nullable();
}

// Publindex serializes dates as ISO timestamps anchored at UTC-5 (see parseDateToIso). The schema accepts either plain YYYY-MM-DD or full ISO; both round-trip through Date without loss.
const isoDate = z
  .string()
  .refine((s) => !isNaN(new Date(s).getTime()), { message: 'fecha inválida' })
  .nullable();

const titleConstraint = FIELD_CONSTRAINTS.titulo;
const titleParaleloConstraint = FIELD_CONSTRAINTS.titulo_ingles;
const resumenConstraint = FIELD_CONSTRAINTS.resumen;
const doiConstraint = FIELD_CONSTRAINTS.doi;
const urlConstraint = FIELD_CONSTRAINTS.url;
const palabrasConstraint = FIELD_CONSTRAINTS.palabras_clave;

export const articlePayloadSchema = z
  .object({
    idFasciculo: z.number().int().positive('idFasciculo debe ser un entero positivo'),

    txtTituloArticulo: z
      .string()
      .trim()
      .min(titleConstraint.min!, `título debe tener al menos ${titleConstraint.min} caracteres`)
      .max(titleConstraint.max!, `título excede ${titleConstraint.max} caracteres`),

    txtUrl: z
      .string()
      .trim()
      .min(1, 'txtUrl es requerido')
      .max(urlConstraint.max!, `txtUrl excede ${urlConstraint.max} caracteres`)
      .regex(/^https?:\/\//, 'txtUrl debe iniciar con http:// o https://'),

    codGranArea: z
      .string()
      .trim()
      .min(1, 'codGranArea es requerido')
      .refine((c) => areaExists(c), { message: 'codGranArea no existe en el árbol de áreas' }),

    codAreaConocimiento: z
      .string()
      .trim()
      .min(1, 'codAreaConocimiento es requerido')
      .refine((c) => areaExists(c), { message: 'codAreaConocimiento no existe en el árbol de áreas' }),

    tpoDocumento: z.enum(docTypeCodes, { message: 'tpoDocumento fuera de los códigos válidos (1..12)' }),

    txtPalabraClave: z
      .string()
      .max(palabrasConstraint.max!, `txtPalabraClave excede ${palabrasConstraint.max} caracteres`),
    txtTituloParalelo: z.string(),
    txtResumen: z.string(),

    txtDoi: z
      .string()
      .min(doiConstraint.min!, `txtDoi debe tener al menos ${doiConstraint.min} caracteres`)
      .max(doiConstraint.max!, `txtDoi excede ${doiConstraint.max} caracteres`)
      .regex(doiConstraint.pattern!, doiConstraint.patternMessage)
      .nullable(),

    nroPaginaInicial: intStringFromConstraint(FIELD_CONSTRAINTS.pagina_inicial),
    nroPaginaFinal: intStringFromConstraint(FIELD_CONSTRAINTS.pagina_final),
    nroAutores: intStringFromConstraint(FIELD_CONSTRAINTS.numero_autores),
    nroParesEvaluo: intStringFromConstraint(FIELD_CONSTRAINTS.numero_pares_evaluadores),
    nroReferencias: intStringFromConstraint(FIELD_CONSTRAINTS.numero_referencias),

    txtProyecto: z
      .string()
      .min(
        FIELD_CONSTRAINTS.proyecto.min!,
        `txtProyecto debe tener al menos ${FIELD_CONSTRAINTS.proyecto.min} caracteres`,
      )
      .max(FIELD_CONSTRAINTS.proyecto.max!, `txtProyecto excede ${FIELD_CONSTRAINTS.proyecto.max} caracteres`)
      .nullable(),
    txtPalabraClaveIdioma: z.string().max(2000).nullable(),

    codSubAreaConocimiento: z
      .string()
      .refine((c) => areaExists(c), { message: 'codSubAreaConocimiento no existe en el árbol de áreas' })
      .nullable(),

    dtaRecepcion: isoDate,
    dtaVerifFechaAceptacion: isoDate,

    codIdioma: z.enum(langCodes, { message: 'codIdioma fuera de los códigos válidos' }).nullable(),
    codIdiomaOtro: z.enum(langCodes, { message: 'codIdiomaOtro fuera de los códigos válidos' }).nullable(),

    staInternoInstiTit: tfNullable,
    staNacionalExternoInst: tfNullable,
    staInternacionalExternoInst: tfNullable,

    tpoResumen: z.enum(summaryCodes, { message: 'tpoResumen fuera de los códigos válidos (A/D/S)' }).nullable(),
    tpoEspecialista: z
      .enum(specialistCodes, { message: 'tpoEspecialista fuera de los códigos válidos (A/E/B/S)' })
      .nullable(),

    txtAbstract: z
      .string()
      .max(
        FIELD_CONSTRAINTS.resumen_otro_idioma.max!,
        `txtAbstract excede ${FIELD_CONSTRAINTS.resumen_otro_idioma.max} caracteres`,
      )
      .nullable(),
    txtResumenOtro: z
      .string()
      .max(
        FIELD_CONSTRAINTS.resumen_idioma_adicional.max!,
        `txtResumenOtro excede ${FIELD_CONSTRAINTS.resumen_idioma_adicional.max} caracteres`,
      )
      .nullable(),
  })
  .strict()
  .refine((p) => areaBelongsToParent(p.codAreaConocimiento, p.codGranArea), {
    message: 'codAreaConocimiento no es hija de codGranArea',
    path: ['codAreaConocimiento'],
  })
  .refine(
    (p) => p.codSubAreaConocimiento === null || subareaBelongsToArea(p.codSubAreaConocimiento, p.codAreaConocimiento),
    {
      message: 'codSubAreaConocimiento no es hija de codAreaConocimiento',
      path: ['codSubAreaConocimiento'],
    },
  )
  .refine(
    (p) => {
      if (!REQUIRED_FIELDS_BY_DOC_TYPE[p.tpoDocumento].has('palabras_clave')) return true;
      return p.txtPalabraClave.trim().length > 0;
    },
    { message: 'txtPalabraClave es requerido para este tpoDocumento', path: ['txtPalabraClave'] },
  )
  .refine(
    (p) => {
      if (!REQUIRED_FIELDS_BY_DOC_TYPE[p.tpoDocumento].has('titulo_ingles')) return true;
      const v = p.txtTituloParalelo.trim();
      return v.length >= titleParaleloConstraint.min! && v.length <= titleParaleloConstraint.max!;
    },
    {
      message: `txtTituloParalelo es requerido y debe tener ${titleParaleloConstraint.min}–${titleParaleloConstraint.max} caracteres para este tpoDocumento`,
      path: ['txtTituloParalelo'],
    },
  )
  .refine(
    (p) => {
      if (!REQUIRED_FIELDS_BY_DOC_TYPE[p.tpoDocumento].has('resumen')) return true;
      const v = p.txtResumen.trim();
      return v.length >= resumenConstraint.min! && v.length <= resumenConstraint.max!;
    },
    {
      message: `txtResumen es requerido y debe tener ${resumenConstraint.min}–${resumenConstraint.max} caracteres para este tpoDocumento`,
      path: ['txtResumen'],
    },
  )
  .refine(
    (p) => {
      if (p.nroPaginaInicial === null || p.nroPaginaFinal === null) return true;
      return parseInt(p.nroPaginaFinal, 10) > parseInt(p.nroPaginaInicial, 10);
    },
    { message: 'nroPaginaFinal debe ser mayor que nroPaginaInicial', path: ['nroPaginaFinal'] },
  )
  .refine(
    (p) => {
      if (!p.dtaRecepcion || !p.dtaVerifFechaAceptacion) return true;
      return new Date(p.dtaVerifFechaAceptacion).getTime() >= new Date(p.dtaRecepcion).getTime();
    },
    { message: 'dtaVerifFechaAceptacion no puede ser anterior a dtaRecepcion', path: ['dtaVerifFechaAceptacion'] },
  )
  .refine((p) => p.codIdioma === null || p.codIdiomaOtro === null || p.codIdioma !== p.codIdiomaOtro, {
    message: 'codIdiomaOtro no puede ser igual a codIdioma',
    path: ['codIdiomaOtro'],
  });

export function assertValidArticlePayload(payload: unknown): void {
  assertPayload(articlePayloadSchema, payload, 'artículo');
}
