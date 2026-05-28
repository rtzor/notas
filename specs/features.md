# Inventario de features

## Atajos de teclado

| Tecla | Acción |
|-------|--------|
| `→` / `Espacio` / `Enter` | Revelar siguiente fragmento o avanzar slide |
| `←` | Ocultar fragmento anterior o retroceder slide |
| `P` | Mostrar / ocultar panel de notas del presentador |
| `F` | Activar / desactivar pantalla completa |
| `S` | Abrir Speaker View en ventana emergente |
| `R` | Recargar todos los archivos `.md` desde disco |

---

## Layouts disponibles

| Layout | Activación | Descripción |
|--------|-----------|-------------|
| `hero` | Automático (pocas líneas, sin código ni tabla) | Texto grande centrado verticalmente |
| `title` | `<!-- layout: title -->` | Slide de portada/título |
| `code` | Automático (hay `<pre>`) | Espaciado optimizado para bloques de código |
| `table` | Automático (hay `<table>`) | Scroll horizontal, alineación superior |
| `media` | Automático (hay `<img>`) | Márgenes y sombra para imágenes |
| `embed` | Automático (hay embed) | Contenedor para iframe |
| `two-columns` | `<!-- layout: two-columns -->` | Grid 50/50 con `<!-- column -->` |
| `split-code` | `<!-- layout: split-code -->` | Texto a la izquierda, bloque de código a la derecha |
| `media-right` | `<!-- layout: media-right -->` | Imagen a la derecha, texto a la izquierda |
| `media-left` | `<!-- layout: media-left -->` | Imagen a la izquierda, texto a la derecha |
| `image-hero` | `<!-- image: hero -->` | Imagen de portada grande |
| `embed-expanded` | `<!-- embed-expand-step: N -->` (al llegar al paso) | Iframe llena toda la slide, texto oculto |

---

## Features por área

### Carga de contenido
- Descubrimiento automático de slides: carga `1.md` → `2.md` → … hasta primer 404
- Cache bypass en cada fetch (`cache: 'no-store'`)
- Hot-reload con tecla `R` o al devolver el foco a la ventana
- Límite de seguridad: máximo 999 slides por sesión

### Renderizado
- Markdown completo (encabezados, listas, tablas, blockquotes, código, imágenes, enlaces)
- Syntax highlighting automático en bloques de código (highlight.js, tema github-dark)
- Botón copiar en cada bloque `<pre>`: aparece al hover, feedback de checkmark 1.8 s
- Animación de fade-in entre slides (200 ms)
- Tipografía fluida con `clamp()` para adaptar tamaño al ancho de ventana

### Navegación
- Botones anterior / siguiente en la UI
- Teclas de flecha y barra espaciadora
- Click sobre la slide avanza (salvo sobre botones, enlaces e iframes)
- Navegación directa por URL hash (`#3` carga la slide 3)
- Barra de progreso superior animada

### Fragmentos
- `<!-- reveal -->` divide una slide en partes reveladas de una en una
- Retroceder con `←` oculta el último fragmento revelado
- El iframe embed puede ser un fragmento (`embed-step`)
- Fragmento especial `embed-expand-step`: expande el iframe a pantalla completa- `<!-- hide-from: N -->` oculta el bloque contenedor cuando el fragmento activo llega al índice N

### Fondos de slide
- `<!-- background: URL -->` establece una imagen de fondo con overlay oscuro semitransparente
- `<!-- background: matrix -->` activa la animación de lluvia de caracteres estilo Matrix (canvas animado)
- `<!-- bg-image: URL -->` combina imagen de fondo con matrix encima (canvas transparente sobre imagen oscurecida)
- Sin directiva de fondo: efecto sutil de matrix con baja opacidad (decorativo)

### Autoplay
- `<!-- autoplay: N -->` avanza automáticamente a la siguiente slide tras N segundos
- Muestra un indicador visual animado (barra de progreso inferior) durante la cuenta atrás
- Se cancela si el usuario navega manualmente antes de que expire el timer

### Callouts
- Sintaxis compatible con GitHub Flavored Markdown: `> [!NOTE]`, `> [!TIP]`, `> [!WARNING]`, `> [!DANGER]`
- Convertidos a `<div class="callout callout-{tipo}">` con icono emoji correspondiente
- Iconos: ℹ️ NOTE, 💡 TIP, ⚠️ WARNING, ☠️ DANGER
### Notas del presentador
- Panel deslizable en la parte inferior (`P` para toggle)
- Bloques `> **Nota del presentador:**` se extraen del Markdown y no se muestran en la slide
- Las notas se sincronizan en tiempo real con Speaker View

### Speaker View
- Ventana emergente (1440×900) con `speaker.html`
- Muestra slide actual y siguiente lado a lado
- Notas del slide actual y siguiente
- Contador de slides y timer de presentación
- Sincronización en tiempo real vía `BroadcastChannel` + `localStorage`

### Responsive
- Breakpoint mobile `≤700px`: altura de imágenes e iframes reducida
- Breakpoint tablet `≤900px`: padding reducido, hint de teclado oculto, botones más compactos

---

### HTML inline
- El Markdown se procesa con `marked.js` en modo permisivo: se admite HTML crudo directamente en los `.md`
- Se pueden usar `<span>`, `<figure>`, clases CSS personalizadas, etc.
- Sin sanitización: el contenido se asume de confianza (ver Limitaciones)

---

## Limitaciones conocidas

| Área | Limitación |
|------|-----------|
| Numeración de slides | Debe ser secuencial sin saltos (1, 2, 3…). Un hueco detiene la carga. |
| Embeds | Los iframes bloqueados por `X-Frame-Options` del servidor remoto no se pueden incrustar. |
| BroadcastChannel | La sincronización con Speaker View solo funciona en el mismo origen (same-origin). |
| Offline | Requiere acceso a los archivos `vendor/` (ya locales) y un servidor HTTP local. |
| Seguridad | El Markdown se interpreta como HTML de confianza. No apto para contenido de usuarios externos. |
| Escalabilidad | Todas las slides se cargan al inicio. Lento a partir de ~200 slides con mucho contenido. |
