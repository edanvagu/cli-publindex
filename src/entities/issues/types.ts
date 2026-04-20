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
