# Publindex CLI

Herramienta de línea de comandos para cargar masivamente artículos, autores y evaluadores en el sistema [Publindex](https://scienti.minciencias.gov.co/publindex/) de Minciencias (Colombia).

Automatiza el flujo que en la interfaz web toma minutos por artículo: importa metadatos desde un export XML de OJS, genera un Excel prellenado, y luego carga el lote completo al servidor de Publindex vinculando también a los autores a sus artículos respectivos.

---

## Para editores: instalación y uso

### 1. Descargar el ejecutable

En la [página de releases](../../releases/latest) descargue el archivo correspondiente a su sistema:

- **Windows 10/11 (64-bit)**: `publindex-windows-x64.exe`
- **Mac con chip Apple (M1/M2/M3/M4)**: `publindex-macos-arm64.zip`

> Macs con procesador Intel no tienen binario empacado. Si está en un Mac Intel, corra desde código fuente con Node.js 20.19+ (`npm install && npm start`).

### 2. Primera ejecución

**Windows**: doble-click sobre el `.exe`. La primera vez Windows mostrará "Windows protegió su PC" — click en "Más información" → "Ejecutar de todas formas". Solo aparece la primera vez (y tras cada actualización).

**Mac**: doble-click sobre el `.zip` para descomprimir, después doble-click sobre el binario. macOS bloqueará la apertura con un mensaje de Gatekeeper. Click en **Listo** (en inglés: _Done_) — no en "Mover a la Papelera" (_Move to Trash_). Después abra **Ajustes del Sistema** (_System Settings_) → **Privacidad y Seguridad** (_Privacy & Security_), scroll hasta el aviso de bloqueo, y click en **Abrir igualmente** (_Open Anyway_) → confirme con Touch ID o contraseña. Después de esta primera vez, doble-click la abre directo.

### 3. Flujo de trabajo

El CLI presenta un menú. El orden recomendado es:

1. **Importar desde OJS** — Seleccione el archivo XML exportado desde OJS (Native XML Export). La herramienta extrae los artículos y sus autores, y genera un Excel prellenado con los datos que pudo obtener. Las celdas en amarillo son campos obligatorios que deben completarse a mano.

2. Abrir el Excel en su aplicación habitual y completar las celdas amarillas (principalmente el área de conocimiento, tipo de documento, y los números de identificación de los autores).

3. **Validar y cargar artículos** — El CLI valida el Excel, le pide credenciales de Publindex, selecciona el fascículo y sube los artículos uno por uno. Al terminar, ofrece continuar con la vinculación de autores.

4. **Vincular autores** (si no aceptó continuar en el paso anterior) — Busca cada autor en la base de Publindex por número de documento y lo asocia al artículo correspondiente. Si un autor no se encuentra por documento, busca por nombre y le pide al editor escoger de una lista de hasta 20 candidatos.

Durante toda la corrida el Excel se va actualizando con el estado de cada artículo y autor (`subido`, `error:...`, etc.), por lo que puede cerrar el CLI y retomar desde donde quedó.

### Canal alternativo: extensión de navegador

Además del CLI, existe una extensión de Chromium que detecta los formularios de Publindex en el navegador y los rellena desde la misma plantilla Excel. El editor navega manualmente y revisa cada formulario antes de guardar — útil si el backend bloquea automatización o si se prefiere un flujo más visual.

**Instalación fácil** (sin `npm`): en el menú del CLI elige "Instalar extensión de navegador". El CLI extrae la extensión a una carpeta del sistema y abre Chrome. Luego en `chrome://extensions/` → modo desarrollador → "Cargar extensión sin empaquetar" → seleccionar la carpeta que el CLI abrió.

### 4. Salir y volver

El CLI se queda abierto en bucle hasta que se elige "Salir". Si algún flujo falla a mitad de camino, el menú reaparece — los datos ya guardados en el Excel no se pierden.

---

## Para desarrolladores

Requisitos: **Node.js 20.19 o superior** (la etapa `pkg` requiere ≥20.19 para hacer `require()` de módulos ESM).

```bash
npm install
npm test              # vitest, todos verdes
npm start             # corre en modo TypeScript con tsx
```

### Empaquetar binarios

`pkg` puede cross-compilar entre arquitecturas. Los scripts disponibles son:

```bash
npm run build:bundle      # produce dist/publindex.js (~5 MB) — paso intermedio
npm run build:bin         # alias de build:bin:win, para el dev workflow local
npm run build:bin:win     # produce dist/publindex-windows-x64.exe
npm run build:bin:mac-arm64  # produce dist/publindex-macos-arm64
```

### Arquitectura

Proyecto organizado en capas con dependencias unidireccionales:

```
cli/   →   entities/   →   io/   →   utils/
```

- `src/entities/` contiene el modelo de dominio y los servicios por entidad (`articles/`, `authors/`, `issues/`, `auth/`, `areas/`).
- `src/io/` maneja todo lo que toca disco o red: Excel reader/writer, HTTP a Publindex, importador XML OJS, progress tracker.
- `src/cli/` es la presentación: prompts con `inquirer`, logger con `chalk`, commands que orquestan entidades e IO.
- `src/config/constants.ts` tiene endpoints, columnas del Excel, estados, diccionarios de traducción label↔código.

### Release

```bash
git tag v1.2.2
git push origin v1.2.2
```

El workflow en `.github/workflows/release.yml` corre una matriz de dos jobs en paralelo (`windows-latest`, `macos-14` para Apple Silicon), cada uno produce su binario, y un job final publica los dos en una release de GitHub con las notas tomadas de `RELEASE_NOTES.md`.

---

## Limitaciones conocidas

- **Sin firma de código:** los binarios no están firmados, lo que causa la advertencia de SmartScreen en Windows y de Gatekeeper en macOS en la primera ejecución. Firmar en Windows cuesta ~$200/año y en macOS requiere Apple Developer ID ($99/año + notarización); por ahora no se justifica.
- **Sin soporte oficial Linux:** no hay binario empacado para Linux. Desde código fuente corre con Node.js 20.19+ vía `npm install && npm start`.
- **Autores no-CvLAC colombianos:** Publindex bloquea la vinculación de autores colombianos sin CvLAC. El CLI detecta este caso y marca el error en el Excel con una acción requerida.
- **Filiación no vigente:** si un autor no tiene filiación profesional vigente en su CvLAC, Publindex lo asume automáticamente como filiación interna de la revista. El CLI avisa para que el editor lo corrija en CvLAC.
- **Vulnerabilidades en `xlsx` 0.18.5:** SheetJS abandonó la distribución en npm registry y solo publica versiones parchadas en su CDN. Las CVE conocidas (prototype pollution `GHSA-4r6h-8v6p-xvw6` y ReDoS `GHSA-5pgg-2g8v-p4x9`) requieren que un atacante entregue un .xlsx/.csv malicioso al editor y lo convenza de procesarlo localmente; el modelo de uso (CLI local, inputs controlados por el editor) hace el riesgo bajo. Migración a `exceljs` + `csv-parse` está en backlog.
