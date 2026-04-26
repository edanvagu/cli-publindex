import { z } from 'zod';
import { NATIONALITIES } from '../../config/constants';
import { assertPayload } from '../../utils/payload-validator';

const nationalityCodes = Object.keys(NATIONALITIES) as [string, ...string[]];

export const linkReviewerPayloadSchema = z
  .object({
    codRh: z.string().trim().min(1, 'codRh es requerido'),
    idFasciculo: z.number().int().positive('idFasciculo debe ser un entero positivo'),
    anoFasciculo: z
      .number()
      .int()
      .min(1900, 'anoFasciculo fuera de rango razonable')
      .max(2100, 'anoFasciculo fuera de rango razonable'),
    tpoNacionalidad: z
      .enum(nationalityCodes, { message: `tpoNacionalidad debe ser ${nationalityCodes.join('/')}` })
      .nullable()
      .optional(),
  })
  .passthrough();

export function assertValidLinkReviewerPayload(payload: unknown): void {
  assertPayload(linkReviewerPayloadSchema, payload, 'evaluador');
}
