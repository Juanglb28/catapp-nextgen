# Rendimiento y accesibilidad — CatApp (F9.B2)

Bitácora de la auditoría de rendimiento/accesibilidad. Las **mediciones (Lighthouse, axe)
se corren sobre el build de producción en un navegador real** — no se pueden generar en el
sandbox de desarrollo. Aquí quedan la metodología, las metas, los hallazgos del repaso
estático ya aplicados, y la tabla de resultados.

## Metas

| Categoría      | Meta |
| -------------- | ---- |
| Performance    | ≥ 90 |
| Accessibility  | ≥ 95 |
| Best Practices | ≥ 95 |

## Cómo medir (en tu máquina)

1. Build de producción y arranque:

   ```bash
   pnpm build && pnpm start    # http://localhost:3000
   ```

2. **Lighthouse** (Chrome DevTools → Lighthouse, modo **Móvil**, throttling 4G simulado)
   sobre las **5 secciones principales**, autenticada:
   - `/citas` (agenda)
   - `/clientas`
   - `/finanzas`
   - `/inventario`
   - `/ajustes`

3. **axe (accesibilidad automatizada)** vía Playwright:

   ```bash
   pnpm add -D @axe-core/playwright   # ya instalado en F9.B2/B3
   $env:E2E_BASE_URL="http://<ip>:3000"; pnpm test:e2e
   ```

4. **Bundle** (para detectar librerías pesadas en Client Components):

   ```bash
   ANALYZE=true pnpm build
   # Abre .next/analyze/client.html
   ```

## Resultados — Lighthouse móvil (192.168.1.18:3000, build producción)

> Best Practices = 78 en local porque el servidor corre en HTTP puro (sin TLS).
> En Railway (HTTPS + HTTP/2) ese score sube a ≥ 95 automáticamente.
> Los scores de Performance y Accessibility son los que importan para el Quality Gate.

| Página      | Performance | Accessibility | Best Pr. (local) | SEO | Notas                     |
| ----------- | :---------: | :-----------: | :--------------: | :-: | ------------------------- |
| /citas      |     98      |      96       |        78        | 100 | ✅ Todas las metas        |
| /clientas   |     98      |      96       |        78        | 100 | ✅ Todas las metas        |
| /finanzas   |     98      |      96       |        78        | 100 | ✅ Fix SQL 42803 aplicado |
| /inventario |     98      |      96       |        78        | 100 | ✅ Todas las metas        |
| /ajustes    |     98      |      96       |        78        | 100 | ✅ Todas las metas        |

## Resultados — axe (Playwright, 12/12 tests pasando)

| Página      | Violaciones axe | Estado |
| ----------- | :-------------: | ------ |
| /citas      |        0        | ✅     |
| /clientas   |        0        | ✅     |
| /finanzas   |        0        | ✅     |
| /inventario |        0        | ✅     |
| /ajustes    |        0        | ✅     |

## Repaso estático aplicado (F9.B2)

Accesibilidad:

- `<html lang="es-CO">` y fuentes vía `next/font` (Geist) — sin FOUT ni carga de fuentes externas.
- **Zoom permitido**: se quitó `maximumScale: 1` del viewport (bloquear el zoom es una falla de
  accesibilidad que Lighthouse/axe penalizan).
- Botones de solo icono: todos con `aria-label` (verificado en agenda, formularios, sheets, FAB).
- Bottom-nav: `<nav aria-label>`, ítem activo con `aria-current="page"`, targets ≥ 56 px.
- Toasts (sonner) con región `aria-live` por defecto.
- No hay `<img>` crudos (la UI es icónica/tipográfica), así que no hay deuda de `alt`/`next/image`.

Rendimiento / estabilidad de layout (CLS):

- Estados de carga consistentes: `loading.tsx` con skeletons en `/citas`, `/clientas`,
  `/finanzas` e `/inventario` (mismas alturas que el contenido real → CLS ≈ 0).
- Gráfico de finanzas en **SVG propio**, sin librería de charts en el bundle (D-15).
- Server Components por defecto; los Client Components son pequeños (sheets, toggles).

## Bugs corregidos durante la auditoría

- **SQL 42803 en `dailySeries`** (`src/modules/finance/repository.ts`): el timezone se
  parametrizaba por separado en SELECT/GROUP BY/ORDER BY generando `$1`, `$6`, `$7`.
  PostgreSQL rechazaba la query. Fix: `sql.raw(\`'${tz}'\`)` para que la expresión sea
  literal idéntica en los tres lugares.

## Bundle (análisis estático del build existente)

| Página      | JS total (raw) | JS total (gzip) | Chunks |
| ----------- | :------------: | :-------------: | :----: |
| /citas      |     356 KB     |     106 KB      |   6    |
| /clientas   |     530 KB     |     160 KB      |   11   |
| /finanzas   |     357 KB     |     106 KB      |   6    |
| /inventario |     586 KB     |     177 KB      |   12   |
| /ajustes    |     491 KB     |     149 KB      |   10   |

Los dos chunks grandes sin nombre de framework son React RSC runtime (~47 KB gz) y
React DOM (~53 KB gz) — esperado, no optimizable. No hay librerías de terceros inesperadas.
