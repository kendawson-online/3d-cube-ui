# Future Development Ideas

This document captures ideas for the long-term evolution of the 3D Cube UI project. The goals are organized from the most practical improvements to the more ambitious architectural changes.

---

# Guiding Principles

The long-term goal is to evolve the project from a CSS demonstration into a reusable navigation and presentation framework.

Some important design principles:

- Separate the cube engine from the content it displays.
- Prefer stable identifiers over view-relative names.
- Treat the cube as a navigation model rather than a visual effect.
- Keep the architecture modular so new content types and renderers can be added without modifying the core engine.

---

# Phase 1 — Code Cleanup

These changes improve maintainability without changing functionality.

## Split app.js into smaller modules

Current responsibilities are gradually accumulating inside `app.js`.

Possible modules:

```
app.js
cube.js
navigation.js
drag.js
keyboard.js
loader.js
content.js
rotation.js
settings.js
```

Each module should have a single responsibility.

---

## Centralize application state

Instead of many global variables:

```javascript
currentFace
dragging
rotation
lastPitch
...
```

Maintain a single application state object.

```javascript
const state = {
    currentFace,
    rotation,
    dragging,
    ...
};
```

This makes future features easier to implement.

---

## Centralize configuration

Collect animation durations, thresholds, delays, and constants into one configuration object.

```javascript
const CONFIG = {
    animationSpeed: 300,
    dragThreshold: 25,
    ...
};
```

---

## Convert PNG templates to SVG

Current templates use transparent PNG images.

Replacing them with SVG offers several advantages:

- Infinite scaling
- CSS styling
- Theme support
- Dynamic colors using `fill`
- Smaller assets
- Better accessibility
- Easier animation

---

# Phase 2 — Identity vs Orientation

One of the largest architectural improvements is separating **face identity** from **camera orientation**.

## Stable identities

Instead of:

```
front
back
left
right
top
bottom
```

Use permanent identifiers:

```
face1
face2
face3
face4
face5
face6
```

These never change.

---

## Orientation mapping

The cube engine keeps track of which face currently occupies each viewing position.

Example:

```
Front  -> face3

Left   -> face6

Right  -> face1

Back   -> face4

Top    -> face2

Bottom -> face5
```

The words "front", "left", etc. become temporary camera positions rather than permanent identities.

---

## User labels

The application maps stable face IDs to user-facing names.

Example:

```json
{
    "face3": {
        "title": "About"
    }
}
```

The cube engine never knows about "About".

It only knows `face3`.

---

# Phase 3 — Accessibility Improvements

The cube should be usable without relying on visual presentation.

## Improve screen reader support

Announce page titles rather than face numbers.

Example:

```
Showing About.

Face 3 of 6.
```

instead of

```
Face 3
```

---

## Better focus management

When navigation changes:

- Move keyboard focus
- Focus the page heading
- Allow immediate reading by screen readers

---

## Landmark regions

Use semantic HTML:

```
<section>
<header>
<main>
<nav>
```

instead of generic `<div>` containers wherever appropriate.

---

## Navigation help

Provide an accessible help overlay.

Possible keyboard shortcut:

```
?
```

Example announcement:

```
Arrow keys move to adjacent faces.

Number keys jump directly.

Press Home to return to Face 1.
```

---

## Adjacent navigation announcements

Since the cube already contains a navigation graph, expose neighboring pages.

Example:

```
Current page:

About

Adjacent pages:

Left:
Projects

Right:
Contact

Up:
Home

Down:
Blog
```

---

## Continue improving reduced motion support

Expand support for users with motion sensitivity while preserving navigation functionality.

---

# Phase 4 — Content Abstraction

The cube engine should not know where content originates.

Introduce a content provider layer.

```
Cube Engine

↓

Content Provider

↓

Renderer
```

Possible providers:

- HTML
- Markdown
- JSON
- REST API
- Database
- WordPress

Each provider returns a common data model.

Example:

```javascript
{
    id,
    title,
    body,
    image,
    ...
}
```

---

# Phase 5 — Multiple Content Types

The cube should become content agnostic.

Possible built-in renderers:

- HTML
- Markdown
- Image
- Video
- PDF
- Iframe

Example:

```json
{
    "type": "image",
    "src": "photos/sunset.jpg"
}
```

or

```json
{
    "type": "video",
    "src": "intro.mp4"
}
```

The cube engine simply selects the appropriate renderer.

---

# Phase 6 — Configuration Driven Navigation

Move toward a complete configuration model.

Example:

```json
{
    "faces": [
        {
            "id": "face1",
            "title": "Home",
            "ariaLabel": "Home Page",
            "type": "markdown",
            "content": "home.md"
        }
    ]
}
```

Future metadata could include:

- icons
- colors
- themes
- accessibility labels
- descriptions
- permissions

---

# Phase 7 — Website Builder

Create a PHP utility that converts an existing website into a cube.

Example:

```
php cube-builder.php \
    --face1 / \
    --face2 /about \
    --face3 /projects \
    ...
```

The builder would:

- download pages
- extract content
- rewrite links
- generate navigation.json
- optionally cache assets

Deployment would become:

```
/cube
    cube.js
    cube.css
    navigation.json
    content/
```

---

# Phase 8 — CDN Distribution

Allow the cube to be embedded with only a few lines of HTML.

Example:

```html
<link rel="stylesheet" href="cube.css">

<script src="cube.js"></script>

<script>
CubeUI.create({
    navigation: "/data/navigation.json"
});
</script>
```

No build process required.

---

# Long-Term Vision

The project can eventually evolve beyond a website navigation component.

Possible applications:

- Personal websites
- Documentation
- Portfolios
- Photography galleries
- Video galleries
- Product catalogs
- Interactive tutorials
- Educational content
- Digital museum exhibits

---

# Future Ideas

- Plugin architecture for custom renderers
- Theme system
- Multiple cube layouts
- Arbitrary navigation graphs beyond six faces
- Nested cubes
- Multi-language content
- Search integration
- Analytics integration
- CMS plugins
- WordPress integration
- Laravel integration
- Static site generator support
- Markdown-first authoring
- Live content updates
- Offline/PWA support
- Presentation mode
- Kiosk mode
- Touchscreen optimization
- Voice navigation
- VR headset support
- AR presentation mode
- Three.js renderer
- Babylon.js renderer
- WebGPU renderer
- Screen reader optimized renderer
- Flat (2D) renderer using the same navigation model
- Automated unit tests for the rotation graph
- Automated accessibility testing
