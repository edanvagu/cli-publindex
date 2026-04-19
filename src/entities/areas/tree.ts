export interface AreaConocimiento {
  codAreaConocimiento: string;
  codAreaPadre: string | null;
  txtNmeArea: string;
  nroNivel: number;
  areasHijas: AreaConocimiento[] | null;
}

const AREAS_TREE: AreaConocimiento[] = [
  {
    codAreaConocimiento: "1",
    codAreaPadre: null,
    txtNmeArea: "Ciencias Naturales",
    nroNivel: 0,
    areasHijas: [
      { codAreaConocimiento: "1A", codAreaPadre: "1", txtNmeArea: "Matemática", nroNivel: 1, areasHijas: [
        { codAreaConocimiento: "1A01", codAreaPadre: "1A", txtNmeArea: "Matemáticas Puras", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "1A02", codAreaPadre: "1A", txtNmeArea: "Matemáticas Aplicadas", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "1A03", codAreaPadre: "1A", txtNmeArea: "Estadísticas y Probabilidades", nroNivel: 2, areasHijas: null },
      ]},
      { codAreaConocimiento: "1B", codAreaPadre: "1", txtNmeArea: "Computación y Ciencias de la Información", nroNivel: 1, areasHijas: [
        { codAreaConocimiento: "1B01", codAreaPadre: "1B", txtNmeArea: "Ciencias de la Computación", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "1B02", codAreaPadre: "1B", txtNmeArea: "Ciencias de la Información y Bioinformática", nroNivel: 2, areasHijas: null },
      ]},
      { codAreaConocimiento: "1C", codAreaPadre: "1", txtNmeArea: "Ciencias Físicas", nroNivel: 1, areasHijas: [
        { codAreaConocimiento: "1C01", codAreaPadre: "1C", txtNmeArea: "Física atómica, Molecular y Química", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "1C02", codAreaPadre: "1C", txtNmeArea: "Física de la Materia", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "1C03", codAreaPadre: "1C", txtNmeArea: "Física de Partículas y Campos", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "1C04", codAreaPadre: "1C", txtNmeArea: "Física Nuclear", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "1C05", codAreaPadre: "1C", txtNmeArea: "Física de Plasmas y Fluídos", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "1C06", codAreaPadre: "1C", txtNmeArea: "Óptica", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "1C07", codAreaPadre: "1C", txtNmeArea: "Acústica", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "1C08", codAreaPadre: "1C", txtNmeArea: "Astronomía", nroNivel: 2, areasHijas: null },
      ]},
      { codAreaConocimiento: "1D", codAreaPadre: "1", txtNmeArea: "Ciencias Químicas", nroNivel: 1, areasHijas: [
        { codAreaConocimiento: "1D01", codAreaPadre: "1D", txtNmeArea: "Química Orgánica", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "1D02", codAreaPadre: "1D", txtNmeArea: "Química Inorgánica y Nuclear", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "1D03", codAreaPadre: "1D", txtNmeArea: "Química Física", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "1D04", codAreaPadre: "1D", txtNmeArea: "Ciencias de los Polímeros", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "1D05", codAreaPadre: "1D", txtNmeArea: "Electroquímica", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "1D06", codAreaPadre: "1D", txtNmeArea: "Química de los Coloides", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "1D07", codAreaPadre: "1D", txtNmeArea: "Química Analítica", nroNivel: 2, areasHijas: null },
      ]},
      { codAreaConocimiento: "1E", codAreaPadre: "1", txtNmeArea: "Ciencias de la Tierra y Medioambientales", nroNivel: 1, areasHijas: [
        { codAreaConocimiento: "1E01", codAreaPadre: "1E", txtNmeArea: "Geociencias (Multidisciplinario)", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "1E02", codAreaPadre: "1E", txtNmeArea: "Mineralogía", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "1E03", codAreaPadre: "1E", txtNmeArea: "Paleontología", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "1E04", codAreaPadre: "1E", txtNmeArea: "Geoquímica y Geofísica", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "1E05", codAreaPadre: "1E", txtNmeArea: "Geografía Física", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "1E06", codAreaPadre: "1E", txtNmeArea: "Geología", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "1E07", codAreaPadre: "1E", txtNmeArea: "Vulcanología", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "1E08", codAreaPadre: "1E", txtNmeArea: "Ciencias del Medio Ambiente", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "1E09", codAreaPadre: "1E", txtNmeArea: "Meteorología y Ciencias Atmosféricas", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "1E10", codAreaPadre: "1E", txtNmeArea: "Investigación del Clima", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "1E11", codAreaPadre: "1E", txtNmeArea: "Oceanografía, Hidrología y Recursos del Agua", nroNivel: 2, areasHijas: null },
      ]},
      { codAreaConocimiento: "1F", codAreaPadre: "1", txtNmeArea: "Ciencias Biológicas", nroNivel: 1, areasHijas: [
        { codAreaConocimiento: "1F01", codAreaPadre: "1F", txtNmeArea: "Biología Celular y Microbiología", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "1F02", codAreaPadre: "1F", txtNmeArea: "Virología", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "1F03", codAreaPadre: "1F", txtNmeArea: "Bioquímica y Biología Molecular", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "1F04", codAreaPadre: "1F", txtNmeArea: "Métodos de Investigación en Bioquímica", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "1F05", codAreaPadre: "1F", txtNmeArea: "Micología", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "1F06", codAreaPadre: "1F", txtNmeArea: "Biofísica", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "1F07", codAreaPadre: "1F", txtNmeArea: "Genética y Herencia", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "1F08", codAreaPadre: "1F", txtNmeArea: "Biología Reproductiva", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "1F09", codAreaPadre: "1F", txtNmeArea: "Biología del Desarrollo", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "1F10", codAreaPadre: "1F", txtNmeArea: "Botánica y Ciencias de las Plantas", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "1F11", codAreaPadre: "1F", txtNmeArea: "Zoología, Ornitología, Entomología", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "1F12", codAreaPadre: "1F", txtNmeArea: "Biología Marina y del Agua", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "1F13", codAreaPadre: "1F", txtNmeArea: "Ecología", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "1F14", codAreaPadre: "1F", txtNmeArea: "Conservación de la biodiversidad", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "1F15", codAreaPadre: "1F", txtNmeArea: "Biología (Teórica, Matemática, Criobiología, Evolutiva)", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "1F16", codAreaPadre: "1F", txtNmeArea: "Otras Biologías", nroNivel: 2, areasHijas: null },
      ]},
      { codAreaConocimiento: "1G", codAreaPadre: "1", txtNmeArea: "Otras Ciencias Naturales", nroNivel: 1, areasHijas: [
        { codAreaConocimiento: "1G01", codAreaPadre: "1G", txtNmeArea: "Otras Ciencias Naturales", nroNivel: 2, areasHijas: null },
      ]},
    ],
  },
  {
    codAreaConocimiento: "2",
    codAreaPadre: null,
    txtNmeArea: "Ingeniería y Tecnología",
    nroNivel: 0,
    areasHijas: [
      { codAreaConocimiento: "2A", codAreaPadre: "2", txtNmeArea: "Ingeniería Civil", nroNivel: 1, areasHijas: [
        { codAreaConocimiento: "2A01", codAreaPadre: "2A", txtNmeArea: "Ingeniería Civil", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "2A02", codAreaPadre: "2A", txtNmeArea: "Ingeniería Arquitectónica", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "2A03", codAreaPadre: "2A", txtNmeArea: "Ingeniería de la Construcción", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "2A04", codAreaPadre: "2A", txtNmeArea: "Ingeniería Estructural y Municipal", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "2A05", codAreaPadre: "2A", txtNmeArea: "Ingeniería del Transporte", nroNivel: 2, areasHijas: null },
      ]},
      { codAreaConocimiento: "2B", codAreaPadre: "2", txtNmeArea: "Ingenierías Eléctrica, Electrónica e Informática", nroNivel: 1, areasHijas: [
        { codAreaConocimiento: "2B01", codAreaPadre: "2B", txtNmeArea: "Ingeniería Eléctrica y Electrónica", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "2B02", codAreaPadre: "2B", txtNmeArea: "Robótica y Control Automático", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "2B03", codAreaPadre: "2B", txtNmeArea: "Automatización y Sistemas de Control", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "2B04", codAreaPadre: "2B", txtNmeArea: "Ingeniería de Sistemas y Comunicaciones", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "2B05", codAreaPadre: "2B", txtNmeArea: "Telecomunicaciones", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "2B06", codAreaPadre: "2B", txtNmeArea: "Hardware y Arquitectura de Computadores", nroNivel: 2, areasHijas: null },
      ]},
      { codAreaConocimiento: "2C", codAreaPadre: "2", txtNmeArea: "Ingeniería Mecánica", nroNivel: 1, areasHijas: [
        { codAreaConocimiento: "2C01", codAreaPadre: "2C", txtNmeArea: "Ingeniería Mecánica", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "2C02", codAreaPadre: "2C", txtNmeArea: "Mecánica Aplicada", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "2C03", codAreaPadre: "2C", txtNmeArea: "Termodinámica", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "2C04", codAreaPadre: "2C", txtNmeArea: "Ingeniería Aeroespacial", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "2C05", codAreaPadre: "2C", txtNmeArea: "Ingeniería Nuclear", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "2C06", codAreaPadre: "2C", txtNmeArea: "Ingeniería del Audio", nroNivel: 2, areasHijas: null },
      ]},
      { codAreaConocimiento: "2D", codAreaPadre: "2", txtNmeArea: "Ingeniería Química", nroNivel: 1, areasHijas: [
        { codAreaConocimiento: "2D01", codAreaPadre: "2D", txtNmeArea: "Ingeniería Química (Plantas y Productos)", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "2D02", codAreaPadre: "2D", txtNmeArea: "Ingeniería de Procesos", nroNivel: 2, areasHijas: null },
      ]},
      { codAreaConocimiento: "2E", codAreaPadre: "2", txtNmeArea: "Ingeniería de los Materiales", nroNivel: 1, areasHijas: [
        { codAreaConocimiento: "2E01", codAreaPadre: "2E", txtNmeArea: "Ingeniería Mecánica", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "2E02", codAreaPadre: "2E", txtNmeArea: "Cerámicos", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "2E03", codAreaPadre: "2E", txtNmeArea: "Recubrimientos y Películas", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "2E04", codAreaPadre: "2E", txtNmeArea: "Compuestos", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "2E05", codAreaPadre: "2E", txtNmeArea: "Papel y Madera", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "2E06", codAreaPadre: "2E", txtNmeArea: "Textiles", nroNivel: 2, areasHijas: null },
      ]},
      { codAreaConocimiento: "2F", codAreaPadre: "2", txtNmeArea: "Ingeniería Médica", nroNivel: 1, areasHijas: [
        { codAreaConocimiento: "2F01", codAreaPadre: "2F", txtNmeArea: "Ingeniería Médica", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "2F02", codAreaPadre: "2F", txtNmeArea: "Tecnología Médica de Laboratorio", nroNivel: 2, areasHijas: null },
      ]},
      { codAreaConocimiento: "2G", codAreaPadre: "2", txtNmeArea: "Ingeniería Ambiental", nroNivel: 1, areasHijas: [
        { codAreaConocimiento: "2G01", codAreaPadre: "2G", txtNmeArea: "Ingeniería Ambiental y Geológica", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "2G02", codAreaPadre: "2G", txtNmeArea: "Geotécnicas", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "2G03", codAreaPadre: "2G", txtNmeArea: "Ingeniería del Petróleo, Energía y Combustibles", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "2G04", codAreaPadre: "2G", txtNmeArea: "Sensores Remotos", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "2G05", codAreaPadre: "2G", txtNmeArea: "Minería y Procesamiento de Minerales", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "2G06", codAreaPadre: "2G", txtNmeArea: "Ingeniería Marina, Naves", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "2G07", codAreaPadre: "2G", txtNmeArea: "Ingeniería Oceanográfica", nroNivel: 2, areasHijas: null },
      ]},
      { codAreaConocimiento: "2H", codAreaPadre: "2", txtNmeArea: "Biotecnología Ambiental", nroNivel: 1, areasHijas: [
        { codAreaConocimiento: "2H01", codAreaPadre: "2H", txtNmeArea: "Biotecnología Ambiental", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "2H02", codAreaPadre: "2H", txtNmeArea: "Bioremediación, Biotecnología para el Diagnóstico", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "2H03", codAreaPadre: "2H", txtNmeArea: "Ética Relacionada con Biotecnología Ambiental", nroNivel: 2, areasHijas: null },
      ]},
      { codAreaConocimiento: "2I", codAreaPadre: "2", txtNmeArea: "Biotecnología Industrial", nroNivel: 1, areasHijas: [
        { codAreaConocimiento: "2I01", codAreaPadre: "2I", txtNmeArea: "Biotecnología Industrial", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "2I02", codAreaPadre: "2I", txtNmeArea: "Tecnologías de Bioprocesamiento, Biocatálisis, Fermentación", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "2I03", codAreaPadre: "2I", txtNmeArea: "Bioproductos, Biomateriales, Bioplásticos, Biocombustibles", nroNivel: 2, areasHijas: null },
      ]},
      { codAreaConocimiento: "2J", codAreaPadre: "2", txtNmeArea: "Nanotecnología", nroNivel: 1, areasHijas: [
        { codAreaConocimiento: "2J01", codAreaPadre: "2J", txtNmeArea: "Nanomateriales (Producción y Propiedades)", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "2J02", codAreaPadre: "2J", txtNmeArea: "Nanoprocesos (Aplicaciones a Nanoescala)", nroNivel: 2, areasHijas: null },
      ]},
      { codAreaConocimiento: "2K", codAreaPadre: "2", txtNmeArea: "Otras Ingenierías y Tecnologías", nroNivel: 1, areasHijas: [
        { codAreaConocimiento: "2K01", codAreaPadre: "2K", txtNmeArea: "Alimentos y Bebidas", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "2K02", codAreaPadre: "2K", txtNmeArea: "Otras Ingenierías y Tecnologías", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "2K03", codAreaPadre: "2K", txtNmeArea: "Ingeniería de Producción", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "2K04", codAreaPadre: "2K", txtNmeArea: "Ingeniería Industrial", nroNivel: 2, areasHijas: null },
      ]},
    ],
  },
  {
    codAreaConocimiento: "3",
    codAreaPadre: null,
    txtNmeArea: "Ciencias Médicas y de la Salud",
    nroNivel: 0,
    areasHijas: [
      { codAreaConocimiento: "3A", codAreaPadre: "3", txtNmeArea: "Medicina Básica", nroNivel: 1, areasHijas: [
        { codAreaConocimiento: "3A01", codAreaPadre: "3A", txtNmeArea: "Anatomía y morfología", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "3A02", codAreaPadre: "3A", txtNmeArea: "Genética Humana", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "3A03", codAreaPadre: "3A", txtNmeArea: "Inmunología", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "3A04", codAreaPadre: "3A", txtNmeArea: "Neurociencias", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "3A05", codAreaPadre: "3A", txtNmeArea: "Farmacología y Farmacia", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "3A06", codAreaPadre: "3A", txtNmeArea: "Medicina Química", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "3A07", codAreaPadre: "3A", txtNmeArea: "Toxicología", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "3A08", codAreaPadre: "3A", txtNmeArea: "Fisiología (Incluye Citología)", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "3A09", codAreaPadre: "3A", txtNmeArea: "Patología", nroNivel: 2, areasHijas: null },
      ]},
      { codAreaConocimiento: "3B", codAreaPadre: "3", txtNmeArea: "Medicina Clínica", nroNivel: 1, areasHijas: [
        { codAreaConocimiento: "3B01", codAreaPadre: "3B", txtNmeArea: "Andrología", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "3B02", codAreaPadre: "3B", txtNmeArea: "Obstetricia y Ginecología", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "3B03", codAreaPadre: "3B", txtNmeArea: "Pediatría", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "3B04", codAreaPadre: "3B", txtNmeArea: "Cardiovascular", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "3B05", codAreaPadre: "3B", txtNmeArea: "Vascular Periférico", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "3B06", codAreaPadre: "3B", txtNmeArea: "Hematología", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "3B07", codAreaPadre: "3B", txtNmeArea: "Respiratoria", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "3B08", codAreaPadre: "3B", txtNmeArea: "Cuidado Crítico y de Emergencia", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "3B09", codAreaPadre: "3B", txtNmeArea: "Anestesiología", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "3B10", codAreaPadre: "3B", txtNmeArea: "Ortopédica", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "3B11", codAreaPadre: "3B", txtNmeArea: "Cirugía", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "3B12", codAreaPadre: "3B", txtNmeArea: "Radiología, Medicina Nuclear y de Imágenes", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "3B13", codAreaPadre: "3B", txtNmeArea: "Trasplante", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "3B14", codAreaPadre: "3B", txtNmeArea: "Odontología, Cirugía Oral y Medicina Oral", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "3B15", codAreaPadre: "3B", txtNmeArea: "Dermatología y Enfermedades Venéreas", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "3B16", codAreaPadre: "3B", txtNmeArea: "Alergias", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "3B17", codAreaPadre: "3B", txtNmeArea: "Reumatología", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "3B18", codAreaPadre: "3B", txtNmeArea: "Endocrinología y Metabolismo", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "3B19", codAreaPadre: "3B", txtNmeArea: "Gastroenterología y Hepatología", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "3B20", codAreaPadre: "3B", txtNmeArea: "Urología y Nefrología", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "3B21", codAreaPadre: "3B", txtNmeArea: "Oncología", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "3B22", codAreaPadre: "3B", txtNmeArea: "Oftalmología", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "3B23", codAreaPadre: "3B", txtNmeArea: "Otorrinolaringología", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "3B24", codAreaPadre: "3B", txtNmeArea: "Psiquiatría", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "3B25", codAreaPadre: "3B", txtNmeArea: "Neurología Clínica", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "3B26", codAreaPadre: "3B", txtNmeArea: "Geriatría", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "3B27", codAreaPadre: "3B", txtNmeArea: "Medicina General e Interna", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "3B28", codAreaPadre: "3B", txtNmeArea: "Otros Temas de Medicina Clínica", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "3B29", codAreaPadre: "3B", txtNmeArea: "Medicina Complementaria", nroNivel: 2, areasHijas: null },
      ]},
      { codAreaConocimiento: "3C", codAreaPadre: "3", txtNmeArea: "Ciencias de la Salud", nroNivel: 1, areasHijas: [
        { codAreaConocimiento: "3C01", codAreaPadre: "3C", txtNmeArea: "Ciencias del Cuidado de la Salud y Servicios", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "3C02", codAreaPadre: "3C", txtNmeArea: "Políticas de Salud y Servicios", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "3C03", codAreaPadre: "3C", txtNmeArea: "Enfermería", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "3C04", codAreaPadre: "3C", txtNmeArea: "Nutrición y Dietas", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "3C05", codAreaPadre: "3C", txtNmeArea: "Salud Pública", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "3C06", codAreaPadre: "3C", txtNmeArea: "Medicina Tropical", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "3C07", codAreaPadre: "3C", txtNmeArea: "Parasitología", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "3C08", codAreaPadre: "3C", txtNmeArea: "Enfermedades Infecciosas", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "3C09", codAreaPadre: "3C", txtNmeArea: "Epidemiología", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "3C10", codAreaPadre: "3C", txtNmeArea: "Salud Ocupacional", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "3C11", codAreaPadre: "3C", txtNmeArea: "Ciencias del Deporte", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "3C12", codAreaPadre: "3C", txtNmeArea: "Ciencias Socio Biomédicas", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "3C13", codAreaPadre: "3C", txtNmeArea: "Ética", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "3C14", codAreaPadre: "3C", txtNmeArea: "Abuso de Substancias", nroNivel: 2, areasHijas: null },
      ]},
      { codAreaConocimiento: "3D", codAreaPadre: "3", txtNmeArea: "Biotecnología en Salud", nroNivel: 1, areasHijas: [
        { codAreaConocimiento: "3D01", codAreaPadre: "3D", txtNmeArea: "Biotecnología Relacionada con la Salud", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "3D02", codAreaPadre: "3D", txtNmeArea: "Tecnologías para la Manipulación de Células, Tejidos, Órganos", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "3D03", codAreaPadre: "3D", txtNmeArea: "Tecnología para Identificación y Funcionamiento del ADN", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "3D04", codAreaPadre: "3D", txtNmeArea: "Biomateriales (Implantes, Dispositivos, Sensores)", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "3D05", codAreaPadre: "3D", txtNmeArea: "Ética Relacionada con la Biomedicina", nroNivel: 2, areasHijas: null },
      ]},
      { codAreaConocimiento: "3E", codAreaPadre: "3", txtNmeArea: "Otras Ciencias Médicas", nroNivel: 1, areasHijas: [
        { codAreaConocimiento: "3E01", codAreaPadre: "3E", txtNmeArea: "Forénsicas", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "3E02", codAreaPadre: "3E", txtNmeArea: "Otras Ciencias Médicas", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "3E03", codAreaPadre: "3E", txtNmeArea: "Fonoaudiología", nroNivel: 2, areasHijas: null },
      ]},
    ],
  },
  {
    codAreaConocimiento: "4",
    codAreaPadre: null,
    txtNmeArea: "Ciencias Agrícolas",
    nroNivel: 0,
    areasHijas: [
      { codAreaConocimiento: "4A", codAreaPadre: "4", txtNmeArea: "Agricultura, Silvicultura y Pesca", nroNivel: 1, areasHijas: [
        { codAreaConocimiento: "4A01", codAreaPadre: "4A", txtNmeArea: "Agricultura", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "4A02", codAreaPadre: "4A", txtNmeArea: "Forestal", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "4A03", codAreaPadre: "4A", txtNmeArea: "Pesca", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "4A04", codAreaPadre: "4A", txtNmeArea: "Ciencias del Suelo", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "4A05", codAreaPadre: "4A", txtNmeArea: "Horticultura y Viticultura", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "4A06", codAreaPadre: "4A", txtNmeArea: "Agronomía", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "4A07", codAreaPadre: "4A", txtNmeArea: "Protección y Nutrición de las Plantas", nroNivel: 2, areasHijas: null },
      ]},
      { codAreaConocimiento: "4B", codAreaPadre: "4", txtNmeArea: "Ciencias Animales y Lechería", nroNivel: 1, areasHijas: [
        { codAreaConocimiento: "4B01", codAreaPadre: "4B", txtNmeArea: "Ciencias Animales y Lechería", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "4B02", codAreaPadre: "4B", txtNmeArea: "Crías y Mascotas", nroNivel: 2, areasHijas: null },
      ]},
      { codAreaConocimiento: "4C", codAreaPadre: "4", txtNmeArea: "Ciencias Veterinarias", nroNivel: 1, areasHijas: [
        { codAreaConocimiento: "4C01", codAreaPadre: "4C", txtNmeArea: "Ciencias Veterinarias", nroNivel: 2, areasHijas: null },
      ]},
      { codAreaConocimiento: "4D", codAreaPadre: "4", txtNmeArea: "Biotecnología Agrícola", nroNivel: 1, areasHijas: [
        { codAreaConocimiento: "4D01", codAreaPadre: "4D", txtNmeArea: "Biotecnología Agrícola y de Alimentos", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "4D02", codAreaPadre: "4D", txtNmeArea: "Tecnología MG, Clonamiento, Selección Asistida, Diagnóstico", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "4D03", codAreaPadre: "4D", txtNmeArea: "Ética Relacionada a Biotecnología Agrícola", nroNivel: 2, areasHijas: null },
      ]},
      { codAreaConocimiento: "4E", codAreaPadre: "4", txtNmeArea: "Otras Ciencias Agrícolas", nroNivel: 1, areasHijas: [
        { codAreaConocimiento: "4E01", codAreaPadre: "4E", txtNmeArea: "Otras Ciencias Agrícolas", nroNivel: 2, areasHijas: null },
      ]},
    ],
  },
  {
    codAreaConocimiento: "5",
    codAreaPadre: null,
    txtNmeArea: "Ciencias Sociales",
    nroNivel: 0,
    areasHijas: [
      { codAreaConocimiento: "5A", codAreaPadre: "5", txtNmeArea: "Psicología", nroNivel: 1, areasHijas: [
        { codAreaConocimiento: "5A01", codAreaPadre: "5A", txtNmeArea: "Psicología (Incluye Relaciones Hombre-Máquina)", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "5A02", codAreaPadre: "5A", txtNmeArea: "Psicología (Terapias de Aprendizaje, Habla, Visual)", nroNivel: 2, areasHijas: null },
      ]},
      { codAreaConocimiento: "5B", codAreaPadre: "5", txtNmeArea: "Economía y Negocios", nroNivel: 1, areasHijas: [
        { codAreaConocimiento: "5B01", codAreaPadre: "5B", txtNmeArea: "Economía", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "5B02", codAreaPadre: "5B", txtNmeArea: "Econometría", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "5B03", codAreaPadre: "5B", txtNmeArea: "Relaciones Industriales", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "5B04", codAreaPadre: "5B", txtNmeArea: "Negocios y Management", nroNivel: 2, areasHijas: null },
      ]},
      { codAreaConocimiento: "5C", codAreaPadre: "5", txtNmeArea: "Ciencias de la Educación", nroNivel: 1, areasHijas: [
        { codAreaConocimiento: "5C01", codAreaPadre: "5C", txtNmeArea: "Educación General (Incluye Capacitación, Pedagogía)", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "5C02", codAreaPadre: "5C", txtNmeArea: "Educación Especial", nroNivel: 2, areasHijas: null },
      ]},
      { codAreaConocimiento: "5D", codAreaPadre: "5", txtNmeArea: "Sociología", nroNivel: 1, areasHijas: [
        { codAreaConocimiento: "5D01", codAreaPadre: "5D", txtNmeArea: "Sociología", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "5D02", codAreaPadre: "5D", txtNmeArea: "Demografía", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "5D03", codAreaPadre: "5D", txtNmeArea: "Antropología", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "5D04", codAreaPadre: "5D", txtNmeArea: "Etnografía", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "5D05", codAreaPadre: "5D", txtNmeArea: "Temas Especiales (Estudios de Género, Familia)", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "5D06", codAreaPadre: "5D", txtNmeArea: "Trabajo Social", nroNivel: 2, areasHijas: null },
      ]},
      { codAreaConocimiento: "5E", codAreaPadre: "5", txtNmeArea: "Derecho", nroNivel: 1, areasHijas: [
        { codAreaConocimiento: "5E01", codAreaPadre: "5E", txtNmeArea: "Derecho", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "5E02", codAreaPadre: "5E", txtNmeArea: "Penal", nroNivel: 2, areasHijas: null },
      ]},
      { codAreaConocimiento: "5F", codAreaPadre: "5", txtNmeArea: "Ciencias Políticas", nroNivel: 1, areasHijas: [
        { codAreaConocimiento: "5F01", codAreaPadre: "5F", txtNmeArea: "Ciencias Políticas", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "5F02", codAreaPadre: "5F", txtNmeArea: "Administración Pública", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "5F03", codAreaPadre: "5F", txtNmeArea: "Teoría Organizacional", nroNivel: 2, areasHijas: null },
      ]},
      { codAreaConocimiento: "5G", codAreaPadre: "5", txtNmeArea: "Geografía Social y Económica", nroNivel: 1, areasHijas: [
        { codAreaConocimiento: "5G01", codAreaPadre: "5G", txtNmeArea: "Ciencias Ambientales (Aspectos Sociales)", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "5G02", codAreaPadre: "5G", txtNmeArea: "Geografía Económica y Cultural", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "5G03", codAreaPadre: "5G", txtNmeArea: "Estudios Urbanos (Planificación y Desarrollo)", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "5G04", codAreaPadre: "5G", txtNmeArea: "Planificación del Transporte", nroNivel: 2, areasHijas: null },
      ]},
      { codAreaConocimiento: "5H", codAreaPadre: "5", txtNmeArea: "Periodismo y Comunicaciones", nroNivel: 1, areasHijas: [
        { codAreaConocimiento: "5H01", codAreaPadre: "5H", txtNmeArea: "Periodismo", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "5H02", codAreaPadre: "5H", txtNmeArea: "Ciencias de la Información (Aspectos Sociales)", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "5H03", codAreaPadre: "5H", txtNmeArea: "Bibliotecología", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "5H04", codAreaPadre: "5H", txtNmeArea: "Medios y Comunicación Social", nroNivel: 2, areasHijas: null },
      ]},
      { codAreaConocimiento: "5I", codAreaPadre: "5", txtNmeArea: "Otras Ciencias Sociales", nroNivel: 1, areasHijas: [
        { codAreaConocimiento: "5I01", codAreaPadre: "5I", txtNmeArea: "Ciencias Sociales, Interdisciplinaria", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "5I02", codAreaPadre: "5I", txtNmeArea: "Otras Ciencias Sociales", nroNivel: 2, areasHijas: null },
      ]},
    ],
  },
  {
    codAreaConocimiento: "6",
    codAreaPadre: null,
    txtNmeArea: "Humanidades",
    nroNivel: 0,
    areasHijas: [
      { codAreaConocimiento: "6A", codAreaPadre: "6", txtNmeArea: "Historia y Arqueología", nroNivel: 1, areasHijas: [
        { codAreaConocimiento: "6A01", codAreaPadre: "6A", txtNmeArea: "Historia", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "6A02", codAreaPadre: "6A", txtNmeArea: "Arqueología", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "6A03", codAreaPadre: "6A", txtNmeArea: "Historia de Colombia", nroNivel: 2, areasHijas: null },
      ]},
      { codAreaConocimiento: "6B", codAreaPadre: "6", txtNmeArea: "Idiomas y Literatura", nroNivel: 1, areasHijas: [
        { codAreaConocimiento: "6B01", codAreaPadre: "6B", txtNmeArea: "Estudios Generales del Lenguaje", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "6B02", codAreaPadre: "6B", txtNmeArea: "Idiomas Específicos", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "6B03", codAreaPadre: "6B", txtNmeArea: "Estudios Literarios", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "6B04", codAreaPadre: "6B", txtNmeArea: "Teoría Literaria", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "6B05", codAreaPadre: "6B", txtNmeArea: "Literatura Específica", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "6B06", codAreaPadre: "6B", txtNmeArea: "Lingüística", nroNivel: 2, areasHijas: null },
      ]},
      { codAreaConocimiento: "6C", codAreaPadre: "6", txtNmeArea: "Otras historias", nroNivel: 1, areasHijas: [
        { codAreaConocimiento: "6C01", codAreaPadre: "6C", txtNmeArea: "Historia de la Ciencia y Tecnología", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "6C02", codAreaPadre: "6C", txtNmeArea: "Otras Historias Especializadas", nroNivel: 2, areasHijas: null },
      ]},
      { codAreaConocimiento: "6D", codAreaPadre: "6", txtNmeArea: "Arte", nroNivel: 1, areasHijas: [
        { codAreaConocimiento: "6D01", codAreaPadre: "6D", txtNmeArea: "Artes plásticas y visuales", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "6D02", codAreaPadre: "6D", txtNmeArea: "Música y musicología", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "6D03", codAreaPadre: "6D", txtNmeArea: "Danza o Artes danzarías", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "6D04", codAreaPadre: "6D", txtNmeArea: "Teatro, dramaturgia o artes escénicas", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "6D05", codAreaPadre: "6D", txtNmeArea: "Otras artes", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "6D06", codAreaPadre: "6D", txtNmeArea: "Artes audiovisuales", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "6D07", codAreaPadre: "6D", txtNmeArea: "Arquitectura y Urbanismo", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "6D08", codAreaPadre: "6D", txtNmeArea: "Diseño", nroNivel: 2, areasHijas: null },
      ]},
      { codAreaConocimiento: "6E", codAreaPadre: "6", txtNmeArea: "Otras Humanidades", nroNivel: 1, areasHijas: [
        { codAreaConocimiento: "6E01", codAreaPadre: "6E", txtNmeArea: "Otras Humanidades", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "6E02", codAreaPadre: "6E", txtNmeArea: "Filosofía", nroNivel: 2, areasHijas: null },
        { codAreaConocimiento: "6E03", codAreaPadre: "6E", txtNmeArea: "Teología", nroNivel: 2, areasHijas: null },
      ]},
    ],
  },
];

const flatMap = new Map<string, { nombre: string; padre: string | null }>();

function buildFlatMap(areas: AreaConocimiento[]) {
  for (const area of areas) {
    flatMap.set(area.codAreaConocimiento, {
      nombre: area.txtNmeArea,
      padre: area.codAreaPadre,
    });
    if (area.areasHijas) {
      buildFlatMap(area.areasHijas);
    }
  }
}

buildFlatMap(AREAS_TREE);

export function areaExists(codigo: string): boolean {
  return flatMap.has(codigo);
}

export function getAreaName(codigo: string): string | undefined {
  return flatMap.get(codigo)?.nombre;
}

export function getAreaParent(codigo: string): string | null | undefined {
  return flatMap.get(codigo)?.padre;
}

export function getGranAreas(): { codigo: string; nombre: string }[] {
  return AREAS_TREE.map(a => ({ codigo: a.codAreaConocimiento, nombre: a.txtNmeArea }));
}

export function getChildAreas(codGranArea: string): { codigo: string; nombre: string }[] {
  const granArea = AREAS_TREE.find(a => a.codAreaConocimiento === codGranArea);
  if (!granArea?.areasHijas) return [];
  return granArea.areasHijas.map(a => ({ codigo: a.codAreaConocimiento, nombre: a.txtNmeArea }));
}

export function getChildSubareas(codArea: string): { codigo: string; nombre: string }[] {
  for (const granArea of AREAS_TREE) {
    if (!granArea.areasHijas) continue;
    const area = granArea.areasHijas.find(a => a.codAreaConocimiento === codArea);
    if (area?.areasHijas) {
      return area.areasHijas.map(a => ({ codigo: a.codAreaConocimiento, nombre: a.txtNmeArea }));
    }
  }
  return [];
}

export function areaBelongsToParent(codArea: string, codGranArea: string): boolean {
  return getAreaParent(codArea) === codGranArea;
}

export function subareaBelongsToArea(codSubarea: string, codArea: string): boolean {
  return getAreaParent(codSubarea) === codArea;
}

// Lookups por label (nombre visible). El Excel tiene dropdowns con labels;
// estas funciones traducen label → código antes de enviar a la API de Publindex.

export function getGranAreaCodeByName(name: string): string | undefined {
  const match = AREAS_TREE.find(g => g.txtNmeArea === name);
  return match?.codAreaConocimiento;
}

export function getAreaCodeByName(name: string, granAreaCode: string): string | undefined {
  const gran = AREAS_TREE.find(g => g.codAreaConocimiento === granAreaCode);
  const match = gran?.areasHijas?.find(a => a.txtNmeArea === name);
  return match?.codAreaConocimiento;
}

export function getSubareaCodeByName(name: string, areaCode: string): string | undefined {
  for (const gran of AREAS_TREE) {
    const area = gran.areasHijas?.find(a => a.codAreaConocimiento === areaCode);
    const match = area?.areasHijas?.find(s => s.txtNmeArea === name);
    if (match) return match.codAreaConocimiento;
  }
  return undefined;
}

export { AREAS_TREE };
