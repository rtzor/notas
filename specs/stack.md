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

## Estructura de archivos

```
mis_notas_3/
├── index.html          Vista principal de presentación
├── speaker.html        Vista del presentador (ventana emergente)
├── app.js              Toda la lógica (~850 líneas)
├── style.css           Estilos de index.html (~820 líneas)
├── speaker.css         Estilos de speaker.html
├── vendor/             Dependencias locales
├── 1.md … N.md         Slides de contenido (carga secuencial automática)
├── v1.html, v2.html    Demos embebibles
└── specs/              Este directorio
```

## Cómo ejecutar

Requiere un servidor HTTP local (los `fetch` de archivos `.md` no funcionan con `file://`):

```bash
# Python
python -m http.server 8080

# Node.js
npx serve .
```

Abrir `http://localhost:8080` en el navegador.
