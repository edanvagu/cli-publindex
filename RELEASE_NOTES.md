# v1.0.0 — Primer release

Herramienta de línea de comandos para cargar artículos, autores y evaluadores a Publindex (Minciencias) desde un Excel generado a partir de un export OJS.

## ¿Qué puedes hacer?

- **Preparar plantilla desde OJS**: importa el XML del fascículo (y opcionalmente el CSV de revisiones) y genera un Excel prellenado con validaciones por tipo de documento (los campos obligatorios se pintan solos según el tipo).
- **Ruta automatizada**: el CLI carga directamente a Publindex — artículos, luego autores, luego evaluadores — con reintentos, pausas para no saturar el servidor, y un archivo de progreso que evita perder estado si el Excel está abierto.
- **Ruta con extensión**: una extensión de Chrome viene empacada en el propio binario; se instala en dos clics y rellena los formularios de Publindex desde el mismo Excel para quien prefiera un flujo manual-asistido.
- **Picker multi-selección**: antes de subir, eliges cuáles artículos procesar — los demás quedan intactos en el Excel sin bloquear la validación.
- **Menú en dos niveles** con navegación hacia atrás y salida siempre visibles, diseñado para editores no-técnicos.

## Sistema operativo

- **Windows 10 / 11 (64-bit)**. En el primer arranque Windows SmartScreen puede mostrar un aviso: "Más información" → "Ejecutar de todas formas". Solo aparece la primera vez.
- macOS / Linux: no hay binario oficial en esta versión. Desde código fuente funciona (`npm install && npm start`) si tiene Node.js 20+.

## Instalación de la extensión (opcional)

Desde el menú del CLI → "Cargar a Publindex" → "Ruta con extensión" → "Instalar / actualizar extensión". El CLI extrae los archivos a `C:\Users\<usuario>\.publindex\extension`, abre el Explorador en esa carpeta, y muestra los pasos para cargarla en Chrome (`chrome://extensions/` → Modo desarrollador → "Cargar extensión sin empaquetar").

## Enlaces

- Código: https://github.com/edanvagu/cli-publindex
- Reportar problemas: pestaña **Issues** del repositorio.
- Contacto: eavasquezgu@gmail.com
