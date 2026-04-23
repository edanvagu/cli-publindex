# Arquitectura — Publindex CLI

## Objetivo

El proyecto automatiza la carga de artículos, la vinculación de autores y la vinculación de evaluadores (pares revisores) en el sistema [Publindex](https://scienti.minciencias.gov.co/publindex/) (Minciencias). Lee metadatos desde un export XML de OJS + un CSV de revisiones, o desde un Excel ya prellenado. Valida contra el catálogo Minciencias y hace upload secuencial vía API REST con reintentos, pausas adaptativas y persistencia de progreso en el mismo Excel.

La arquitectura está organizada **por entidades** (articles, authors, reviewers, persons, auth, issues, areas) con capas internas delgadas. La regla del proyecto: agregar una entidad nueva no debe forzar tocar código existente — solo agregar una carpeta paralela bajo `src/entities/`.

## Capas y dependencias

```
┌─────────────────────────────────────────────────────────┐
│  cli/                                                    │
│    index.ts (router)                                     │
│    commands/   (un comando por flujo)                    │
│    prompts.ts  (inputs del usuario via inquirer)         │
│    logger.ts   (outputs formateados con chalk)           │
└──────────────────┬──────────────────────────────────────┘
                   │ usa
                   ▼
┌─────────────────────────────────────────────────────────┐
│  entities/                                               │
│    articles/     (types, validator, mapper, api, uploader)│
│    authors/      (types, api, uploader)                  │
│    reviewers/    (types, api, uploader)                  │
│    persons/      (types, api) — primitivas compartidas   │
│    auth/         (types, api, session)                   │
│    issues/       (types, api)                            │
│    areas/        (tree + lookups Minciencias)            │
└──────────────────┬──────────────────────────────────────┘
                   │ usa
                   ▼
┌─────────────────────────────────────────────────────────┐
│  io/                                                     │
│    publindex-http.ts      (HTTP client Publindex + cookies)│
│    http-probe.ts          (verificador genérico 2xx)     │
│    excel-reader.ts        (lectura .xlsx/.xls → ArticleRow)│
│    authors-reader.ts      (lectura hoja Autores)         │
│    reviewers-reader.ts    (lectura hoja Evaluadores)     │
│    excel-writer.ts        (rows → .xlsx con estilos+lookups)│
│    xlsx-parser.ts, row-mapper.ts                         │
│    ojs-xml.ts             (streaming parser de export OJS)│
│    ojs-csv.ts             (parser CSV de revisiones OJS) │
│    progress.ts            (estado persistente Excel+sidecar)│
└──────────────────┬──────────────────────────────────────┘
                   │ usa
                   ▼
┌─────────────────────────────────────────────────────────┐
│  utils/  (puro, sin deps del proyecto)                   │
│    async.ts, dates.ts, retry.ts, text.ts, urls.ts        │
│  config/                                                 │
│    constants.ts       (endpoints, defaults, enums)       │
└─────────────────────────────────────────────────────────┘
```

**Regla de dependencia:** las flechas siempre van hacia abajo. Una capa nunca importa de una superior.

- `cli/` puede importar de `entities/`, `io/`, `utils/`, `config/`.
- `entities/` puede importar de `io/`, `utils/`, `config/`. **No importa de `cli/`.**
- `io/` puede importar de `utils/`, `config/`. **No importa de `entities/` ni `cli/`.**
- `utils/` no importa de nada del proyecto (solo stdlib y deps de npm).

## Responsabilidad por carpeta

### `src/cli/`

**Qué vive aquí:** interacción con el usuario (prompts con inquirer, outputs con chalk), ruteo entre comandos según la opción del menú. Los archivos son "delgados" — orquestan llamadas a `entities/` e `io/`, nunca contienen lógica de dominio.

- `index.ts` — router del menú principal. Un `switch` despacha a un comando.
- `commands/{import-ojs,upload-articles,upload-authors,shared}.ts` — un archivo por comando. Contiene el flujo end-to-end de ese caso de uso (pedir inputs → llamar servicios → mostrar resultados). `shared.ts` agrupa pasos reutilizables como `loginOrThrow`, `fetchAndSelectIssue`, `ensureTokenCoversEstimate`.
- `prompts.ts` — funciones que piden inputs del usuario (`promptCredentials`, `selectIssue`, `promptFilePath`, etc.). Encapsula también el diálogo nativo de archivos (PowerShell en Windows, osascript en Mac).
- `logger.ts` — helpers de output (`success`, `warning`, `info`, `error`, `showValidation`, `showSummary`, `showPickerReference`, `showCandidatesTable`, etc.).

**Qué NO vive aquí:** lógica de negocio, llamadas HTTP directas, parseo de archivos, validación de dominio.

### `src/entities/<entity>/`

**Qué vive aquí:** dominio + servicios por entidad. Cada entidad es una carpeta independiente con los mismos archivos estándar:

- `types.ts` — interfaces TypeScript de la entidad.
- `validator.ts` — reglas de validación de negocio. Pura, sin I/O.
- `mapper.ts` — transformación entre shapes (ej. `ArticleRow` → `ArticlePayload`). Pura.
- `api.ts` — operaciones contra el API Publindex (usa `io/publindex-http`).
- `uploader.ts` — orquestación de cargas batch con reintentos, pausas adaptativas y progreso.

**Qué NO vive aquí:** prompts del usuario, output coloreado, streaming de archivos grandes (eso va en `io/`).

Las 7 entidades actuales:

- `articles/` — artículos (validator + mapper + api + uploader completos).
- `authors/` — autores: búsqueda por documento o nombre, picker interactivo cuando hay ambigüedad, vinculación al artículo creado.
- `reviewers/` — pares revisores (evaluadores en la UI de Publindex): mismo patrón que autores, pero el vínculo es por fascículo (no por artículo) y el uploader hace un pre-chequeo `GET /evaluadores/fasciculos/{id}` para saltar pares ya vinculados.
- `persons/` — primitivas compartidas de búsqueda de personas (`searchPersons`, `getTrayectoria`) consumidas tanto por `authors` como por `reviewers`. Solo tiene `types.ts` + `api.ts`, sin uploader.
- `auth/` — login + gestión de sesión JWT (`tokenValid`, expiración derivada del JWT).
- `issues/` — fascículos (listar, seleccionar).
- `areas/` — taxonomía de áreas de conocimiento Minciencias en árbol (lookup read-only por código y por nombre).

### `src/io/`

**Qué vive aquí:** adaptadores que tocan el mundo exterior (HTTP, filesystem, parsers de formatos externos). Plano — sin subcarpetas.

- `publindex-http.ts` — cliente HTTP específico del API Publindex (Bearer token, headers de browser, jar de cookies persistente, decompresión gzip/brotli).
- `http-probe.ts` — verificador genérico `probeUrl()` (HEAD con fallback a GET, sigue redirects).
- `excel-reader.ts`, `xlsx-parser.ts`, `row-mapper.ts` — pipeline de lectura de la hoja Artículos del Excel.
- `authors-reader.ts` — lectura de la hoja Autores (segunda hoja del mismo workbook).
- `reviewers-reader.ts` — lectura de la hoja Evaluadores (tercera hoja del workbook).
- `excel-writer.ts` — generación de plantilla Excel: estilos (celdas amarillas obligatorias), dropdowns con cascada gran_area → area → subarea, hoja `_lookups` oculta para los `VLOOKUP`, hoja `Instrucciones`, tres hojas de datos (`Artículos`, `Autores`, `Evaluadores`).
- `ojs-xml.ts` — streaming parser del export Native XML de OJS (puede pesar cientos de MB con PDFs inline en base64; los descarta en vuelo).
- `ojs-csv.ts` — parser del CSV de revisiones (`reviews-YYYYMMDD.csv`) exportado por OJS. Filtra a una fascículo dado por `submissionId`, deduplica por username OJS.
- `progress.ts` — tracker persistente de progreso (escribe a columnas del Excel; si el archivo está bloqueado por Excel, cae en sidecar JSON y reconcilia al cerrar).

**Qué NO vive aquí:** lógica de dominio, decisiones de negocio, prompts.

### `src/utils/`

**Qué vive aquí:** utilidades puras, sin dependencias del proyecto.

- `async.ts` — `sleep()` con AbortSignal.
- `dates.ts` — parsing de fechas (YYYY-MM-DD y DD/MM/YYYY) + conversión a ISO UTC-5 que espera Publindex.
- `retry.ts` — `withRetry()` con backoff exponencial.
- `text.ts` — `cleanHtml()` (strip tags + decode entities).
- `urls.ts` — normalización y construcción de URLs.
- `time.ts` — `formatDuration()` (segundos → "1h 23m").

### `src/config/`

- `constants.ts` — `ENDPOINTS` (URLs Publindex), `DEFAULTS` (timeouts, reintentos, pausas, márgenes de token), diccionarios (`DOCUMENT_TYPES`, `SUMMARY_TYPES`, `SPECIALIST_TYPES`, `LANGUAGES`, `NATIONALITIES`), `EXCEL_HEADERS` y `AUTHORS_SHEET_HEADERS` (columnas del Excel), `ARTICLE_STATES` y `AUTHOR_STATES` (valores escritos a la columna `estado`/`estado_carga`).

**Los nombres de las constantes están en inglés**; los **valores** en español están permitidos solo cuando son strings que terminan en el Excel que ve el editor o que matchean el catálogo Publindex.

## Flujo end-to-end (orden recomendado)

```
1. Importar desde OJS              →  (XML + CSV opcional) → Excel con hojas Artículos + Autores + Evaluadores
2. (Editor completa celdas amarillas en el Excel)
3. Validar y cargar artículos      →  POST /articulos por cada fila → escribe id_articulo al Excel
4. Vincular autores                →  busca cada autor en Publindex → POST /autores
5. Vincular evaluadores            →  selecciona fascículo → pre-check → POST /evaluadores
```

El Excel es la fuente de verdad: cada paso lee y escribe sobre el mismo workbook. `estado`, `fecha_subida`, `id_articulo` para artículos; `estado_carga`, `tiene_cvlac`, `accion_requerida` para autores y evaluadores. El editor puede cerrar el CLI y retomar — el `ProgressTracker` lee el estado anterior y procesa solo lo pendiente.

Los evaluadores se vinculan a nivel **fascículo** (no artículo), por lo que la hoja Evaluadores no tiene `id_articulo`. Al arrancar el paso 5 el editor elige el fascículo destino con el mismo prompt que usan los pasos 3 y 4, y el uploader hace un `GET /evaluadores/fasciculos/{id}` al inicio para saltar evaluadores cuyo `codRh` ya está vinculado (idempotencia frente a links manuales desde la UI).

## Flujo típico — importar OJS

```
User
  │
  │ ejecuta "npm start" → selecciona "Importar desde OJS"
  ▼
cli/index.ts (router)
  │
  ▼
cli/commands/import-ojs.ts
  │
  │ 1. promptOjsFilePath()                         ←  cli/prompts.ts
  │ 2. importFromOjs(xmlPath)                      ←  io/ojs-xml.ts
  │    │
  │    │ stream → regex extract <article>         (salta base64 inline)
  │    │ parseArticle(block)                        → OjsArticle[]
  │    ▼
  │ 3. promptJournalBaseUrl()                     ←  cli/prompts.ts
  │ 4. Para cada artículo:
  │    a. buildArticleUrl(base, submissionId)    ←  utils/urls.ts
  │    b. probeUrl(url)                           ←  io/http-probe.ts   (paralelo)
  │ 5. promptSavePath()                           ←  cli/prompts.ts
  │ 6. ojsArticleToRow(art, url)                  ←  io/ojs-xml.ts
  │ 7. generateTemplateWithData(rows, path)       ←  io/excel-writer.ts
  │    │
  │    │ aplica estilos a celdas obligatorias vacías (amarillo)
  │    ▼
  │ 8. warning/info outputs                       ←  cli/logger.ts
```

## Convenciones de código

### Datos en tests, fixtures y ejemplos

- Solo data ficticia. Nunca DOIs reales, ORCIDs reales, cédulas reales, títulos de artículos reales o nombres de autores reales.
- Placeholders convencionales: `Jane Doe`, `Autor Prueba 1`, `test@example.com`, `10.0000/fake.0001`, `0000-0000-0000-0000`, `00000000`. La hoja `Instrucciones` que genera `excel-writer.ts` ya sigue esta regla (URLs `revistas.ejemplo.edu.co`, fechas 2026-XX-XX inventadas).

## Patrón para agregar una entidad nueva

Tomar `entities/authors/` como referencia. Pasos típicos:

1. **Crear `src/entities/<entity>/`** con:
   - `types.ts` — interfaces.
   - `validator.ts` — reglas puras de validación (sin I/O). Reutilizar `ValidationError`/`ValidationResult` de `articles/types.ts` cuando aplique.
   - `mapper.ts` — `<entity>RowToPayload(row): <Entity>Payload`. Pura.
   - `api.ts` — operaciones contra Publindex usando `authedRequest` de `io/publindex-http.ts`. Throw con mensaje útil en errores no-2xx.
   - `uploader.ts` — `run<Entity>Upload(session, rows, options)`. Loop secuencial con `withRetry` + pausa adaptativa entre items + callbacks de progreso (`onProgress`, `onRetry`, `onPause`, `onWarning`). Modelar sobre `articles/uploader.ts` o `authors/uploader.ts`.

2. **Agregar el endpoint** a `ENDPOINTS` en `src/config/constants.ts`. Si el endpoint usa diccionarios catálogo Minciencias, agregar el `Record<string, string>` (keys = código, values = label en español).

3. **Si el flujo lee un Excel adicional**, agregar el reader en `src/io/`. Reutilizar `normalizeHeader()` de `excel-reader.ts` para mantener tolerancia a tildes/casing en headers.

4. **Crear `src/cli/commands/<flow>.ts`** copiando la estructura de `upload-articles.ts` o `upload-authors.ts`. Reutilizar `loginOrThrow`, `fetchAndSelectIssue`, `ensureTokenCoversEstimate` de `commands/shared.ts`.

5. **Agregar opción al menú** en `src/cli/prompts.ts:mainMenu()` y el case correspondiente en `src/cli/index.ts:dispatch()`. Extender el type `ExecutionMode` en `src/entities/articles/types.ts`.

6. **Tests** en `tests/entities/<entity>/{validator,mapper,uploader}.test.ts`. Solo data ficticia (regla de la skill).

No se debería tocar `articles/`, `authors/`, `auth/`, `io/` (excepto si hay un nuevo formato de archivo), ni `utils/`. Ese es el punto del diseño por entidad.

## Puntos abiertos conocidos

- `ExecutionMode` vive en `entities/articles/types.ts` pero conceptualmente es un enum cross-entity. Si crecen los comandos, mover a `shared/types.ts` o `cli/types.ts`.
- No hay tests para `cli/commands/*` (los comandos orquestan I/O y son difíciles de testear sin mocks pesados de inquirer). Los tests cubren la lógica de dominio (`entities/`) y de I/O (`io/`).
- Los identificadores que mirror-ean contratos externos (API Publindex, columnas Excel) siguen intencionalmente en español — ver la tabla de la sección "Convenciones de código".
