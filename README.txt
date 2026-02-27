# Personal Manager (V3)

Versión **estable para GitHub Pages** (sin service-worker), con tema **más claro** y estructura simple.

## Qué incluye
- **Home** con 3 módulos: Trabajo, Economía, Agenda.
- **Trabajo**
  - Turnos con **selector de color**
  - Calendario mensual
  - Rotación automática opcional (patrón por días)
  - Edición por día (horas, extras, velada, nota)
- **Economía**
  - Cuentas
  - Dentro de cada cuenta: Movimientos, Tarjetas, Gastos fijos, Créditos, Metas
- **Agenda**
  - Calendario + eventos por día

✅ Todo se guarda en `localStorage` (en tu navegador).

## Subir a GitHub Pages (importante)
1. Sube **estos archivos en la raíz** del repo:
   - `index.html`
   - `styles.css`
   - `app.js`
   - `manifest.json`
   - `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` (opcionales)
2. En **Settings → Pages**
   - Source: **Deploy from a branch**
   - Branch: `main`
   - Folder: `/ (root)`

## Si ves una versión antigua (caché)
- Recarga con **Ctrl+F5**
- O añade a la URL: `?v=123`

Ej: `https://TUUSUARIO.github.io/TUREPO/?v=123`
