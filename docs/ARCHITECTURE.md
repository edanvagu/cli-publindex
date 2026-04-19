# Arquitectura — Publindex CLI

## Objetivo

El proyecto automatiza la carga de artículos de revistas académicas colombianas al sistema Publindex (Minciencias), lee metadatos desde Excel/CSV/OJS XML, valida, y hace upload secuencial vía API REST con retries y progreso.

La arquitectura está organizada **por entidades** (articles, auth, issues, areas) con capas internas delgadas, pensada para escalar a la Fase 2 (carga de autores + evaluadores) sin tocar código existente — solo agregando carpetas paralelas.

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
│    articles/   (types, validator, mapper, api, uploader) │
│    auth/       (types, api, session)                     │
│    issues/     (types, api)                              │
│    areas/      (tree + lookups)                          │
└──────────────────┬──────────────────────────────────────┘
                   │ usa
                   ▼
┌─────────────────────────────────────────────────────────┐
│  io/                                                     │
│    publindex-http.ts  (cliente HTTP Publindex)           │
│    http-probe.ts      (verificador genérico 2xx)         │
│    excel-reader.ts    (lectura .xlsx/.xls/.csv → rows)   │
│    excel-writer.ts    (rows → .xlsx con estilos)         │
│    xlsx-parser.ts, csv-parser.ts, row-mapper.ts          │
│    ojs-xml.ts         (streaming parser de OJS)          │
│    progress.ts        (estado persistente Excel+sidecar) │
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
- `commands/{validate,upload-articles,import-ojs,generate-template}.ts` — un archivo por comando. Contiene el flujo end-to-end de ese caso de uso (pedir inputs → llamar servicios → mostrar resultados).
- `prompts.ts` — funciones que piden inputs del usuario (`promptCredentials`, `selectIssue`, `promptFilePath`, etc.).
- `logger.ts` — helpers de output (`success`, `warning`, `info`, `error`, `showValidation`, `showSummary`, etc.).

**Qué NO vive aquí:** lógica de negocio, llamadas HTTP directas, parseo de archivos, validación de dominio.

### `src/entities/<entity>/`

**Qué vive aquí:** dominio + servicios por entidad. Cada entidad es una carpeta independiente con los mismos archivos estándar:

- `types.ts` — interfaces TypeScript de la entidad. Los keys de tipos que cruzan contratos externos (Excel, API Publindex) quedan en español; los keys puramente internos en inglés.
- `headers.ts` — metadata de columnas Excel (si aplica).
- `validator.ts` — reglas de validación de negocio. Pura, sin I/O.
- `mapper.ts` — transformación entre shapes (ej. `ArticleRow` → `ArticlePayload`). Pura.
- `api.ts` — operaciones CRUD contra el API Publindex (usa `io/publindex-http`).
- `uploader.ts` — orquestación de cargas batch con retries, pausas, progreso.

**Qué NO vive aquí:** prompts del usuario, output coloreado, streaming de archivos grandes (eso va en `io/`).

Las 4 entidades actuales:
- `articles/` — artículos (entidad principal, completa).
- `auth/` — login + gestión de sesión JWT.
- `issues/` — fascículos (listar, seleccionar).
- `areas/` — taxonomía de áreas de conocimiento Minciencias (lookup read-only).

### `src/io/`

**Qué vive aquí:** adaptadores que tocan el mundo exterior (HTTP, filesystem, parsers de formatos externos). Plano — sin subcarpetas.

- `publindex-http.ts` — cliente HTTP específico del API Publindex (Bearer token, JSON, timeouts).
- `http-probe.ts` — verificador genérico `probeUrl()` (HEAD con fallback a GET).
- `excel-reader.ts`, `xlsx-parser.ts`, `csv-parser.ts`, `row-mapper.ts` — pipeline de lectura de archivos de artículos.
- `excel-writer.ts` — generación de plantilla Excel con estilos (celdas amarillas, hojas auxiliares).
- `ojs-xml.ts` — streaming parser de export Native XML de OJS (175MB+, con PDFs inline en base64).
- `progress.ts` — tracker persistente de progreso (escribe a columnas del Excel + sidecar JSON para resiliencia).

**Qué NO vive aquí:** lógica de dominio, decisiones de negocio, prompts.

### `src/utils/`

**Qué vive aquí:** utilidades puras, sin dependencias del proyecto.

- `async.ts` — `sleep()` con AbortSignal.
- `dates.ts` — parsing de fechas (YYYY-MM-DD y DD/MM/YYYY) + conversión a ISO UTC-5 que espera Publindex.
- `retry.ts` — `withRetry()` con backoff exponencial.
- `text.ts` — `cleanHtml()` (strip tags + decode entities).
- `urls.ts` — normalización y construcción de URLs.

### `src/config/`

- `constants.ts` — `ENDPOINTS` (URLs Publindex), `DEFAULTS` (timeouts, reintentos, pausas), diccionarios (`DOCUMENT_TYPES`, `SUMMARY_TYPES`, `LANGUAGES`, etc.), `EXCEL_HEADERS` (columnas del Excel), `ARTICLE_STATES` (valores del campo `estado`).

**Los nombres de las constantes están en inglés, los valores de strings siguen en español** porque esos valores terminan escribiéndose al Excel que el usuario lee.

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

## Idiomas en el código

| Dónde | Idioma | Por qué |
|---|---|---|
| Nombres de tipos, funciones, constantes, variables internas | Inglés | Código |
| Strings de mensajes al usuario (CLI output) | Español | Lo lee el editor |
| Strings de errores de validación | Español | Los lee el editor |
| Keys de `ArticleRow` (`titulo`, `doi`, `pagina_inicial`...) | Español | Son nombres de columnas del Excel |
| Keys de `ArticlePayload` (`txtTituloArticulo`, `idFasciculo`...) | Español con prefijos Publindex | Contrato con API |
| Keys de `LoginResponse`, `Issue` | Español | Contrato con API |
| Valores de `ARTICLE_STATES` (`'pendiente'`, `'subido'`...) | Español | Se escriben al Excel |
| Valores de `DOCUMENT_TYPES`, `LANGUAGES`, etc. | Español | Se muestran en hojas del Excel |
| Keys internos de structs (`ValidationError.fila`, `UploadResult.exitosos`...) | Español | Consistencia con `ArticleRow`; reflejan conceptos del Excel |
| Parámetros internos y locals en funciones | Mixto | El refactor renombró los principales; algunos menos importantes quedan en español por tamaño del cambio |

## Cómo agregar una entidad nueva (Fase 2 — authors, reviewers)

Patrón para `authors`:

1. **Crear `src/entities/authors/`** con:
   - `types.ts` — `Author`, `AuthorRow`, `AuthorPayload`, etc. Aplicar la misma regla de idiomas: type names inglés, keys que coinciden con Excel o API en español.
   - `headers.ts` — constante `AUTHOR_EXCEL_HEADERS` con las columnas del Excel de autores.
   - `validator.ts` — `validateAuthorBatch(rows): ValidationResult`. Reusar `ValidationError/Result/Warning` de `articles/types.ts` o mover a un shared si aplica.
   - `mapper.ts` — `authorRowToPayload(row): AuthorPayload`.
   - `api.ts` — `createAuthor(token, payload)`. Usa `httpRequest` de `io/publindex-http.ts`.
   - `uploader.ts` — `runAuthorUpload(session, authors, options)`. Modelar sobre `articles/uploader.ts` (mismo patrón de loop + pausa + progreso).

2. **Agregar `AUTHORS` al `ENDPOINTS`** en `src/config/constants.ts`.

3. **Agregar diccionarios específicos** (si aplica) — ej. `AUTHOR_ROLES`, tipos de identificación. Nombres en inglés, valores en español.

4. **Extender `src/io/excel-reader.ts`** si los autores vienen en un Excel distinto:
   - Crear `src/io/excel-reader-authors.ts` o generalizar `excel-reader.ts` para que acepte una config de headers.

5. **Crear `src/cli/commands/upload-authors.ts`** copiando la estructura de `upload-articles.ts`. Llama a `validateAuthorBatch`, `runAuthorUpload`, usa `promptFilePath` (reusable).

6. **Agregar opción al menú** en `src/cli/prompts.ts:mainMenu()`:
   ```ts
   { name: 'Cargar autores', value: 'upload-authors' as ExecutionMode }
   ```
   Y extender el type `ExecutionMode` en `src/entities/articles/types.ts` (o mover a un `shared/types.ts` si crece).

7. **Agregar case al router** en `src/cli/index.ts`:
   ```ts
   case 'upload-authors':
     await uploadAuthors();
     return;
   ```

8. **Tests** en `tests/entities/authors/{validator,mapper,uploader}.test.ts`. Espejar la estructura de `tests/entities/articles/`.

No se debería tocar nada en `articles/`, `io/` (excepto si hay un nuevo formato de archivo), ni en `utils/`. Ese es el punto del diseño por entidad.

## Puntos abiertos conocidos

- `ExecutionMode` vive en `entities/articles/types.ts` pero conceptualmente es un enum cross-entity. Si crecen los comandos en Fase 2, mover a un `shared/types.ts` o `cli/types.ts`.
- No hay tests para `cli/commands/*` (los comandos orquestan, son difíciles de testear sin mocks pesados de inquirer). Los tests cubren la lógica de dominio (`entities/`) y de I/O (`io/`) que es donde vive el código con lógica real.
- Algunas **keys de tipos contractuales** (API Publindex, columnas Excel) siguen intencionalmente en español — no son code smell, son requisitos externos. Ver la tabla "Idiomas en el código" más arriba.
