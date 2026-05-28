# Guía de autoría de slides

Las slides son archivos Markdown numerados: `1.md`, `2.md`, … La aplicación los carga en orden y se detiene en el primer número que no existe.

---

## Estructura de un archivo `.md`

```markdown
<!-- directivas de metadatos (opcionales, al inicio) -->

Contenido en Markdown normal

> **Nota del presentador:** Texto visible solo en Speaker View
```

---

## Directivas de metadatos

Se escriben como comentarios HTML `<!-- clave: valor -->` al principio del archivo.

### Layout

| Directiva | Efecto |
|-----------|--------|
| `<!-- layout: title -->` | Slide de portada/título (tipografía grande, centrada) |
| `<!-- layout: two-columns -->` | Divide el contenido en dos columnas iguales usando `<!-- column -->` |
| `<!-- layout: split-code -->` | Texto a la izquierda, bloque de código a la derecha |
| `<!-- layout: media-right -->` | Imagen a la derecha, texto a la izquierda |
| `<!-- layout: media-left -->` | Imagen a la izquierda, texto a la derecha |
| `<!-- image: hero -->` | Imagen de portada grande (estilo hero) |

### Fondo

| Directiva | Tipo | Efecto |
|-----------|------|--------|
| `<!-- background: matrix -->` | keyword | Animación Matrix (lluvia de caracteres verdes sobre fondo oscuro) |
| `<!-- background: URL -->` | string | Imagen de fondo con overlay oscuro semitransparente |
| `<!-- bg-image: URL -->` | string | Imagen de fondo + animación matrix encima (canvas transparente) |

**Ejemplo — slide de portada con matrix e imagen:**
```markdown
<!-- layout: title -->
<!-- background: matrix -->
<!-- bg-image: pres.png -->

# Título de la presentación
```

### Autoplay

| Directiva | Tipo | Efecto |
|-----------|------|--------|
| `<!-- autoplay: 5 -->` | número (segundos) | Avanza automáticamente a la siguiente slide tras N segundos |

### Embed (iframe interactivo)

| Directiva | Tipo | Efecto |
|-----------|------|--------|
| `<!-- embed: URL -->` | string | Incrusta un iframe con la URL indicada |
| `<!-- embed-height: 420 -->` | número px | Alto del iframe (por defecto: 420) |
| `<!-- embed-step: 1 -->` | número | El iframe es un fragmento: aparece al avanzar N veces |
| `<!-- embed-expand-step: 2 -->` | número | Al avanzar N veces, el iframe ocupa toda la slide y el texto desaparece |

**Ejemplo — demo que aparece en el primer clic y se expande en el segundo:**
```markdown
<!-- embed: v2.html -->
<!-- embed-height: 380 -->
<!-- embed-step: 1 -->
<!-- embed-expand-step: 2 -->

# Título visible inicialmente

Explicación del contenido...
```

---

## Directivas de contenido

### `<!-- reveal -->` — fragmentos revelables

Divide el contenido de la slide en partes que se revelan de una en una al avanzar.

```markdown
# Título siempre visible

Primer párrafo visible desde el inicio.

<!-- reveal -->

Este párrafo aparece al primer avance.

<!-- reveal -->

Este aparece al segundo avance.
```

### `<!-- hide-from: N -->` — ocultar contenido desde un fragmento

Oculta el bloque que contiene la directiva cuando el fragmento activo alcanza el índice N. Útil para reemplazar texto por un embed al avanzar.

```markdown
## Título visible siempre

<!-- hide-from: 1 -->
- Ítem visible solo antes del primer avance
- Desaparece cuando aparece el embed

<!-- embed: demo.html -->
<!-- embed-step: 1 -->
```

### `<!-- column -->` — layout de dos columnas

Requiere `<!-- layout: two-columns -->` en las directivas. Divide el contenido en columnas.

```markdown
<!-- layout: two-columns -->

# Título compartido

Texto de la columna izquierda.

<!-- column -->

Texto de la columna derecha.
```

---

## Callouts

Sintaxis compatible con GitHub Flavored Markdown. Se renderizan como cajas destacadas con icono.

```markdown
> [!NOTE]
> Información útil pero no crítica.

> [!TIP]
> Consejo práctico para el audiencia.

> [!WARNING]
> Aviso importante; puede causar problemas.

> [!DANGER]
> Acción destructiva o riesgo severo.
```

Iconos asignados: ℹ️ NOTE · 💡 TIP · ⚠️ WARNING · ☠️ DANGER

---

## HTML inline

El Markdown admite HTML crudo. Se puede usar para estilos puntuales no disponibles en Markdown puro:

```markdown
# <span class="glow-green">Texto con glow verde</span>
```

El HTML no se sanitiza; usar solo con contenido propio de confianza.

---

## Notas del presentador

Se escriben como bloques `blockquote` con el marcador exacto. No se renderizan en la slide; aparecen en el panel de notas (tecla `P`) y en Speaker View.

```markdown
> **Nota del presentador:** Primera línea de la nota.
> Segunda línea (continúa con `>`).
> Tercera línea.
```

Las líneas continuadas con `>` se unen en un único párrafo de texto plano.

---

## Ejemplo completo

```markdown
<!-- layout: two-columns -->

# Comparativa de enfoques

<!-- column -->

## Sin estructura
- Resultado impredecible
- Difícil de mantener

<!-- column -->

## Con estructura
- Resultados repetibles
- Fácil de iterar

<!-- reveal -->

> La clave es la especificidad del contexto.

> **Nota del presentador:** Aquí haces la pregunta al público: "¿Cuántos habéis tenido que regenerar más de 3 veces?"
```
