# v1.1.0 — Dos rutas, picker y extensión empacada

Cambios importantes respecto a v1.0.1. El menú se reorganizó en dos niveles: primero eliges qué hacer, luego eliges el canal para cargar (automatizado o con extensión).

## Nuevo menú (principal)

```
1. Preparar plantilla desde OJS
2. Cargar a Publindex
   ├── Ruta automatizada          (el CLI carga por usted)
   └── Ruta con extensión         (usted rellena los formularios)
3. Ayuda: cómo exportar desde OJS
4. Sobre el proyecto / donar
```

Las dos primeras opciones son el flujo diario; las dos últimas son de contexto.

## Novedades

- **Picker multi-selección antes de subir**: en la ruta automatizada, antes de empezar los requests, eliges con checkboxes cuáles artículos procesar. Los que no marcas quedan intactos en el Excel, y la validación tampoco los revisa — ya no tienes que rellenar amarillos de artículos que no vas a subir.
- **Excel con reglas dinámicas**: los campos obligatorios se pintan de amarillo según el `tipo_documento` elegido en cada fila. Si cambias el tipo, el amarillo se re-evalúa solo. Descubrimos con Playwright cuáles campos pide Publindex por cada uno de los 12 tipos de documento y codificamos esas reglas en el Excel.
- **Ruta con extensión empacada**: la extensión de Chrome viene dentro del binario. Desde el menú → Ruta con extensión → Instalar / actualizar extensión, se extrae a `C:\Users\<usuario>\.publindex\extension` y te muestra los pasos para cargarla en Chrome.
- **Progreso que no se pierde con el Excel abierto**: si el Excel está abierto durante la carga automatizada, el CLI guarda el progreso en un archivo JSON temporal; al final pregunta "¿cerró el Excel? guardar ahora" y sincroniza. Ya no se pierde el `id_articulo` ni los estados.
- **Ayuda de exportación de OJS**: una opción del menú principal explica paso a paso cómo sacar el XML (Módulo XML nativo → Exportar números) y el CSV (Estadísticas → Generador de informes → Informe de Revisión).
- **Sobre / donar**: sección que credita al desarrollador, enlaza al GitHub, y muestra la llave Bre-B para donaciones (Colombia).

## Cambios menores

- Menú con "Volver" y "Salir" visibles en cada sub-nivel.
- Cabecera que muestra dónde estás: `=== Cargar a Publindex · Ruta automatizada ===`.
- Mensajes más concisos en los comandos; se quitaron confirmaciones que llevaban a rutas equivocadas.
- Disclaimer en el banner inicial sobre responsabilidad del usuario.

## Sistema operativo

- **Windows 10 / 11 (64-bit)**. En el primer arranque Windows SmartScreen puede mostrar un aviso: "Más información" → "Ejecutar de todas formas". Solo aparece la primera vez.
- **macOS / Linux**: esta versión descontinúa el binario oficial para Mac (el de v1.0.1 no estaba notarizado y daba "app no certificada"). Desde código fuente sigue funcionando (`npm install && npm start`) si tiene Node.js 20+.

## Enlaces

- Código: https://github.com/edanvagu/cli-publindex
- Reportar problemas: pestaña **Issues** del repositorio.
- Contacto: eavasquezgu@gmail.com
