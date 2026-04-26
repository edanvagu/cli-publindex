# v1.2.1

Primera versión con soporte oficial para macOS. Incluye mejoras importantes en la extensión de navegador, en el manejo de errores y en el seguimiento del progreso de carga.

## Lo nuevo

### Soporte macOS (Apple Silicon e Intel)

Ahora el release publica binarios para los tres sistemas operativos:

- `publindex-windows-x64.exe` — Windows 10/11.
- `publindex-macos-arm64.zip` — Mac con chip Apple (M1, M2, M3, M4).
- `publindex-macos-x64.zip` — Mac con procesador Intel.

### Extensión de navegador (Publindex Autofill v0.2.0)

- **Widget reactivo entre secciones**: al cambiar de "Artículos" a "Autores" o "Evaluadores" dentro del editor de Publindex, el modal flotante se actualiza automáticamente — ya no es necesario refrescar la página.
- **Llenado de fechas corregido**: el formato de fecha entre el Excel, la CLI y los formularios de Publindex está alineado de extremo a extremo.
- **Mejor robustez**: el modal sobrevive a recargas de la extensión desde `chrome://extensions/` sin contaminar la consola con errores de "Extension context invalidated".

### Confiabilidad de la carga

- **Circuit breaker**: si 5 elementos fallan seguidos o más de 20 fallan en total durante una corrida, la CLI aborta automáticamente para no seguir presionando un servidor que claramente no responde bien.
- **Validación con Zod en el borde de red**: los payloads que se envían a Publindex se validan antes de salir, lo que ayuda a detectar inconsistencias del Excel, debido a que el backend no cuenta con validaciones.
- **Seguimiento persistente del progreso**: el estado de cada artículo, autor y evaluador se guarda en una hoja paralela del Excel (o en un archivo `.progreso.json` si el Excel está abierto). Permite reanudar cargas interrumpidas sin re-procesar lo que ya quedó subido.

### Compatibilidad con redes corporativas (Windows)

- Inyección automática del trust store de Windows en la capa TLS de Node, lo que evita el error `UNABLE_TO_GET_ISSUER_CERT_LOCALLY` en editores que están detrás de un proxy corporativo con certificado MITM.

## Instalación

### Windows

1. Descargue `publindex-windows-x64.exe`.
2. Doble-click sobre el archivo. Si Windows muestra el aviso "SmartScreen impidió que se iniciara una aplicación no reconocida", haga click en "Más información" → "Ejecutar de todas formas".

### Mac con chip Apple (M1, M2, M3 o M4)

1. Descargue `publindex-macos-arm64.zip`.
2. Doble-click sobre el `.zip` para descomprimir. Quedará el archivo `publindex-macos-arm64`.
3. Doble-click sobre el archivo. macOS bloqueará la apertura con un mensaje del tipo "no se puede verificar el desarrollador". Click en **Listo** (en inglés: _Done_). **No** elija "Mover a la Papelera" (_Move to Trash_).
4. Abra **Ajustes del Sistema** (menú Apple → Ajustes del Sistema; en inglés: _System Settings_) → **Privacidad y Seguridad** (_Privacy & Security_) → en el panel derecho, scroll hacia abajo hasta ver el aviso "publindex-macos-arm64 se bloqueó para proteger tu Mac" → click en **Abrir igualmente** (_Open Anyway_).
5. Aparece un diálogo de confirmación. Click en **Abrir igualmente** otra vez. Si pide Touch ID o contraseña, confírmela.
6. La CLI arranca. Esto se hace una sola vez por instalación; las próximas veces el doble-click la abre directo.

### Mac con procesador Intel

Igual que el caso anterior, pero descargue `publindex-macos-x64.zip`.

> **¿Mi Mac es Apple Silicon o Intel?** Click en el menú Apple (esquina superior izquierda) → "Acerca de este Mac". Si dice "Chip M1/M2/M3/M4" es Apple Silicon. Si dice "Procesador Intel" es Intel.

## Actualización de la extensión

Si ya tenía instalada la extensión v0.1.0:

1. Abra la CLI y entre al menú "Instalar extensión" para extraer la versión nueva.
2. En el navegador, vaya a `chrome://extensions/` (o `edge://extensions/`) y haga click en el ícono de recargar (↻) sobre la tarjeta "Publindex Autofill".
