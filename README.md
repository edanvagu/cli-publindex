# Publindex CLI

Herramienta de línea de comandos para cargar masivamente artículos y autores en el sistema [Publindex](https://scienti.minciencias.gov.co/publindex/) de Minciencias (Colombia).

Automatiza el flujo que en la interfaz web toma minutos por artículo: importa metadatos desde un export XML de OJS, genera un Excel prellenado, y luego carga el lote completo al servidor de Publindex vinculando también a los autores a sus artículos respectivos.

---

## Para editores: instalación y uso

### 1. Descargar el ejecutable

En la [página de releases](../../releases/latest) elija el archivo que corresponda a su sistema:

| Sistema                   | Archivo                     |
| ------------------------- | --------------------------- |
| Windows                   | `publindex-windows-x64.exe` |
| Mac (chip Apple M1/M2/M3) | `publindex-macos-arm64`     |

> Macs con procesador Intel (fabricados antes de 2021) no tienen binario disponible; necesitan instalar Node.js y correr desde el código fuente — escríbame si es su caso.

### 2. Primera ejecución

**Windows:** doble clic sobre el `.exe`. La primera vez Windows mostrará una advertencia "Windows protegió su PC" — haga clic en "Más información" y luego "Ejecutar de todas formas". Solo aparece la primera vez (y tras cada actualización).

**Mac:** abra Terminal, arrastre el archivo descargado a la ventana para pegar su ruta y presione Enter. La primera vez Mac dirá "no se puede verificar el desarrollador" — vaya a Ajustes del sistema → Privacidad y seguridad → haga clic en "Abrir de todas formas", y vuelva a ejecutar.

### 3. Flujo de trabajo

El CLI presenta un menú. El orden recomendado es:

1. **Importar desde OJS** — Seleccione el archivo XML exportado desde OJS (Native XML Export). La herramienta extrae los artículos y sus autores, y genera un Excel prellenado con los datos que pudo obtener. Las celdas en amarillo son campos obligatorios que deben completarse a mano.

2. Abrir el Excel en su aplicación habitual y completar las celdas amarillas (principalmente el área de conocimiento, tipo de documento, y los números de identificación de los autores).

3. **Validar y cargar artículos** — El CLI valida el Excel, le pide credenciales de Publindex, selecciona el fascículo y sube los artículos uno por uno. Al terminar, ofrece continuar con la vinculación de autores sin volver a pedir credenciales.

4. **Vincular autores** (si no aceptó continuar en el paso anterior) — Busca cada autor en la base de Publindex por número de documento y lo asocia al artículo correspondiente. Si un autor no se encuentra por documento, busca por nombre y le pide al editor escoger de una lista de hasta 20 candidatos.

Durante toda la corrida el Excel se va actualizando con el estado de cada artículo y autor (`subido`, `error:...`, etc.), por lo que puede cerrar el CLI y retomar desde donde quedó.

### Canal alternativo: extensión de navegador

Además del CLI (que hace POSTs directos al backend), existe una extensión de Chromium que detecta los formularios de Publindex en el navegador y los rellena desde la misma plantilla Excel. El editor navega manualmente y revisa cada formulario antes de guardar — útil si el backend bloquea automatización o si se prefiere un flujo más visual.

**Instalación fácil** (sin `npm`): en el menú del CLI elige "Instalar extensión de navegador". El CLI extrae la extensión a una carpeta del sistema y abre Chrome. Luego en `chrome://extensions/` → modo desarrollador → "Cargar descomprimida" → seleccionar la carpeta que el CLI abrió.

### 4. Salir y volver

El CLI se queda abierto en bucle hasta que se elige "Salir". Si algún flujo falla a mitad de camino, el menú reaparece — los datos ya guardados en el Excel no se pierden.

---

## Para desarrolladores

Requisitos: **Node.js 20 o superior**.

```bash
npm install
npm test              # 203 tests, todos verdes
npm start             # corre en modo TypeScript con tsx
```

### Empaquetar binarios

El bundle con `esbuild` ya funciona en Node 18+, pero la etapa `pkg` requiere Node 20+:

```bash
npm run build:bundle  # produce dist/publindex.js (~5 MB)
npm run build:bin     # produce binarios Windows + Mac en dist/
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
git tag v1.0.0
git push origin v1.0.0
```

El workflow en `.github/workflows/release.yml` compila en Windows, Mac ARM y Mac Intel, y publica los binarios en una release de GitHub.

---

## Limitaciones conocidas

- **Sin firma de código:** los binarios no están firmados, lo que causa las advertencias de primera ejecución descritas arriba. Firmar en Windows cuesta ~$200/año y en Mac ~$99/año; por ahora no se justifica.
- **Mac Linux:** Linux no tiene diálogo nativo de archivos sin instalar dependencias adicionales; los usuarios Linux pueden correr el CLI vía Node (`node dist/publindex.js`) y usar la opción "escribir ruta manualmente".
- **Autores no-CvLAC colombianos:** Publindex bloquea la vinculación de autores colombianos sin CvLAC. El CLI detecta este caso y marca el error en el Excel con una acción requerida.
- **Filiación no vigente:** si un autor no tiene filiación profesional vigente en su CvLAC, Publindex lo asume automáticamente como filiación interna de la revista. El CLI avisa para que el editor lo corrija en CvLAC.
