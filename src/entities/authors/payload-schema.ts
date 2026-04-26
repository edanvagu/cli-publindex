import { z } from 'zod';
import { NATIONALITIES } from '../../config/constants';
import { assertPayload } from '../../utils/payload-validator';

const nationalityCodes = Object.keys(NATIONALITIES) as [string, ...string[]];

export const linkAuthorPayloadSchema = z
  .object({
    codRh: z.string().trim().min(1, 'codRh es requerido'),
    idArticulo: z.number().int().positive('idArticulo debe ser un entero positivo'),
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

export function assertValidLinkAuthorPayload(payload: unknown): void {
  assertPayload(linkAuthorPayloadSchema, payload, 'autor');
}
