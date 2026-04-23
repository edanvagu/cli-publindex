import inquirer from 'inquirer';
import { warning, showPickerReference, showCandidatesTable } from './logger';
import { PersonSearchResult } from '../entities/persons/types';

export interface PersonPickReference {
  _fila: number;
  nombre_completo: string;
  nacionalidad: string;
  identificacion: string;
  filiacion_institucional?: string;
}

export type PersonPicker = (
  candidates: PersonSearchResult[],
  reference: PersonPickReference,
) => Promise<PersonSearchResult | null>;

export function buildPersonPicker(): PersonPicker {
  return async (candidates, reference) => {
    console.log('');
    const reason = reference.identificacion
      ? `el documento "${reference.identificacion}" no encontró coincidencia`
      : 'no se proporcionó identificación';
    warning(`Fila ${reference._fila}: ${reason}. Se buscó por nombre "${reference.nombre_completo}" y hay ${candidates.length} resultado(s).`);

    showPickerReference({
      _fila: reference._fila,
      nombre_completo: reference.nombre_completo,
      filiacion_institucional: reference.filiacion_institucional,
      nacionalidad: reference.nacionalidad,
      identificacion: reference.identificacion,
    });

    showCandidatesTable(candidates.map(c => ({
      nombre: fullName(c),
      documento: c.nroDocumentoIdent || '—',
      pais: c.nmePaisNacim || '—',
      email: c.txtEmail || '—',
    })));

    const choices = candidates.map((c, i) => ({
      name: `${i + 1}. ${fullName(c)}${c.nmePaisNacim ? ' — ' + c.nmePaisNacim : ''}`,
      value: c,
    }));
    choices.push({ name: 'Ninguno — marcar error', value: null as unknown as PersonSearchResult });

    const { pick } = await inquirer.prompt([
      {
        type: 'list',
        name: 'pick',
        message: '¿Cuál es la persona correcta? (compare país/nombre con la tabla arriba)',
        choices,
        pageSize: Math.min(choices.length + 1, 15),
      },
    ]);
    return pick;
  };
}

function fullName(c: PersonSearchResult): string {
  return c.txtTotalNames
    || [c.txtNamesRh, c.txtPrimApell, c.txtSegApell].filter(Boolean).join(' ')
    || '(sin nombre)';
}
