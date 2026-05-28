# Arquitectura interna

## Modelo de datos

`app.js` mantiene 6 variables globales que representan el estado completo:

```js
let slides = []              // string[] — contenido Markdown de cada slide
let slidesNotes = []         // string[] — notas del presentador de cada slide
let slidesMeta = []          // object[] — metadatos parseados de cada slide
let currentIndex = 0         // índice de slide activo (0-based)
let currentFragmentIndex = 0 // fragmento activo en la slide actual
let currentFragmentTotal = 0 // total de fragmentos en la slide actual
```

Cada entrada de `slidesMeta[i]` tiene esta forma:

```js
{
  layout: null | 'title' | 'two-columns' | 'split-code' | 'media-right' | 'media-left',
  image: null | 'hero',
  embed: null | string,         // URL del iframe
  embedHeight: null | number,   // px
  embedStep: null | number,     // índice de fragmento en que aparece
  embedExpandStep: null | number, // índice en que ocupa toda la slide
  autoplay: null | number,      // segundos para auto-avanzar
  background: null | string,    // 'matrix' o URL de imagen
  bgImage: null | string        // URL de imagen de fondo (con matrix encima)
}
```

---

## Pipeline de carga

```
loadSlides()
  └─ fetch('1.md') … fetch('N.md')  (hasta primer 404)
       └─ extractNotes(raw)
            ├─ Normaliza: elimina BOM, convierte CRLF → LF
            ├─ Parsea directivas <!-- key: value -->  → meta{}
            ├─ Extrae bloques "> **Nota del presentador:**" → notes
            └─ Devuelve content (el Markdown restante)
```

---

## Pipeline de renderizado

Cada llamada a `renderSlide(index)` ejecuta este flujo dentro de un `setTimeout(200ms)`:

```
renderMarkdown(markdown, meta)
  ├─ buildRevealHtml()    divide por <!-- reveal -->, crea .slide-fragment
  │    └─ renderContentHtml()
  │         ├─ buildColumnsHtml()   (si layout=two-columns) divide por <!-- column -->
  │         └─ processCallouts()   convierte > [!TYPE] → <div class="callout callout-type">
  └─ buildEmbedHtml()     crea <section class="slide-embed-frame"> con iframe

container.innerHTML = html

hljs.highlightElement()  por cada <pre><code>
addCopyButtons()         inyecta <button class="copy-btn"> en cada <pre>

stopMatrixBackground()   detiene canvas anterior si existe
fondo de slide:          aplica bg-image CSS o inicia startMatrixBackground()

applySlideLayout()       detecta contenido → añade clase de layout al contenedor
enhanceSlideImages()     envuelve <img> en <figure>, añade <figcaption>
applyFragmentState()     muestra/oculta fragmentos; aplica embed-expanded si procede
  └─ hide-from:          oculta elementos [data-hide-from] cuando fragmentIndex >= N
updateControls()         actualiza botones prev/next y contador
broadcastState()         envía estado a Speaker View

autoplay:                si meta.autoplay, programa setTimeout + indicador visual
```

El token `renderToken` evita que renders obsoletos (slide cambiada antes de que expire el timeout) sobreescriban el resultado correcto.

---

## Sistema de fragmentos

Los fragmentos son elementos con `data-fragment-index="N"` en el DOM:
- Generados por `<!-- reveal -->` → `<div class="slide-fragment" data-fragment-index="N">`
- El embed puede ser un fragmento si tiene `embed-step`
- `embed-expand-step` añade un paso adicional que no corresponde a ningún elemento DOM, por lo que `applyFragmentState` extiende `currentFragmentTotal` manualmente
- `<!-- hide-from: N -->` → `<div data-hide-from="N">` en el DOM; se oculta cuando `currentFragmentIndex >= N`

## Sistema de fondos animados (Matrix)

`startMatrixBackground(opts)` crea un `<canvas>` absoluto dentro de `#slide-frame` y lo anima con `requestAnimationFrame`. Hay dos modos según `fadeAlpha`:

| Modo | Condición | Descripción |
|------|-----------|-------------|
| **Clásico** | `fadeAlpha > 0` | Overlay oscuro entre frames crea efecto de trail; usado cuando `background: matrix` sin imagen |
| **Sutil** | `fadeAlpha === 0` | Canvas transparente con trail explícito en arrays por columna; usado en modo combinado o decorativo |

`stopMatrixBackground()` cancela el `requestAnimationFrame` activo y elimina el canvas del DOM. Se llama antes de cada render para evitar acumulación de canvases.

`ResizeObserver` observa `#slide-frame` para redimensionar el canvas cuando cambia el tamaño de la ventana.

Transiciones de estado por clic / tecla:

```
fragmentIndex < fragmentTotal  →  revealNextFragment()   (permanece en la misma slide)
fragmentIndex === fragmentTotal →  goToSlide(index + 1)  (avanza a la siguiente)
```

---

## Sincronización Speaker View

```
index.html                       speaker.html
──────────────────               ──────────────────
broadcastState()
  ├─ BroadcastChannel.postMessage(payload)  →  applySpeakerState(payload)
  └─ localStorage.setItem('slides-sync-state', JSON.stringify(payload))
                                    └─ storage event también recibe payload
```

`payload` incluye markdown de la slide actual y la siguiente, metadatos, notas, fragmento activo y timestamp de inicio (para el timer).

---

## Navegación por hash

- URL siempre refleja la slide activa: `#1`, `#2`, …  
- Al cargar la página, `getIndexFromHash()` lee el hash y navega directamente a esa slide.  
- `hashchange` se escucha para sincronizar si el usuario navega con el historial del navegador.  
- Se usa `history.replaceState` (no `pushState`) para no contaminar el historial.

---

## Detección automática de layout

`applySlideLayout()` inspecciona el DOM renderizado y aplica clases al contenedor:

| Condición detectada | Clase aplicada |
|---------------------|---------------|
| Pocos elementos (≤2 h1/h2, ≤4 p/li), sin código ni tabla | `hero-layout` |
| `<table>` presente | `table-layout` |
| `<pre>` presente | `code-layout` |
| `<img>` presente | `media-layout` |
| `.slide-embed-frame` presente | `embed-layout` |
| `meta.layout === 'two-columns'` | `two-columns-layout` |
| `meta.image === 'hero'` | `image-hero-layout` |
