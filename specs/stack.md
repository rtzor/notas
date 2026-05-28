# Stack Técnico

## Lenguajes y tecnologías

| Capa | Tecnología |
|------|------------|
| Markup | HTML5 |
| Estilos | CSS3 (sin framework) — variables CSS, `clamp()`, `flexbox`, `grid` |
| Lógica | JavaScript ES6+ vanilla — sin bundler, sin TypeScript |
| Markdown | `marked.js` (vendorizado en `vendor/marked.min.js`) |
| Syntax highlight | `highlight.js` con tema `github-dark` (vendorizado en `vendor/`) |

## Dependencias externas

Todas las dependencias están en `vendor/` (sin conexión a internet necesaria):

```
vendor/
  marked.min.js          Parser de Markdown → HTML
  highlight.min.js       Coloreado de bloques de código
  github-dark.min.css    Tema visual para highlight.js
```

## APIs del navegador utilizadas

- `fetch` — carga dinámica de archivos `.md`
- `BroadcastChannel` — sincronización entre ventanas (Speaker View)
- `localStorage` — fallback de sincronización y estado persistente
- `History API` (`replaceState`) — navegación sin recarga por hash `#N`
- `Clipboard API` (`navigator.clipboard.writeText`) — botón copiar código
- `Fullscreen API` — tecla `F`
- `Canvas API` (2D context) — animación de fondo Matrix (`startMatrixBackground`)
- `ResizeObserver` — redimensionado del canvas Matrix al cambiar el tamaño de ventana

## Estructura de archivos

```
mis_notas_3/
├── index.html          Vista principal de presentación
├── speaker.html        Vista del presentador (ventana emergente)
├── app.js              Toda la lógica (~1000 líneas)
├── style.css           Estilos de index.html
├── speaker.css         Estilos de speaker.html
├── vendor/             Dependencias locales (sin CDN, funciona offline)
├── 1.md … N.md         Slides de contenido (carga secuencial automática)
├── v1.html             Demo embebible — versión 1
├── v2.html             Demo embebible — versión 2 (usada en slides de ejemplo)
├── originals/          Imágenes originales sin optimizar
└── specs/              Este directorio
```

> Los archivos `index.html`, `style.css` y `app.js` usan query strings de cache-busting (`?v=N`) para forzar recarga tras actualizaciones.

## Cómo ejecutar

Requiere un servidor HTTP local (los `fetch` de archivos `.md` no funcionan con `file://`):

```bash
# Python
python -m http.server 8080

# Node.js
npx serve .
```

Abrir `http://localhost:8080` en el navegador.
