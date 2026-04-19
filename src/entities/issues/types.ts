// Issue = fascículo en dominio Publindex. Campos en español porque vienen directo
// del API de Publindex (contrato externo, no se puede traducir sin romper).
export interface Issue {
  id: number;
  idRevista: number;
  idEditor: number | null;
  nroVolumen: string;
  nroNumero: string;
  dtaPublicacion: string;
  nroPaginaInicial: string | null;
  nroPaginaFinal: string | null;
  nroTiraje: string | null;
  txtTituloEspecial: string | null;
  nroArtRecibido: string | null;
  nroArtArbitrado: string | null;
  nroArtRechazado: string | null;
  revista: unknown | null;
  editor: unknown | null;
}
