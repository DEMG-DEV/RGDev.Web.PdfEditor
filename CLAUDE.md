# Guía de Desarrollo y Arquitectura: RGDev.Web.PdfEditor

> **Versión Actual:** `v1.0.0`  
> **Framework:** Vite + React 18 + TypeScript  
> **Estilos:** Tailwind CSS  
> **Servicios:** Stripe (Pagos) + Supabase (Auth & DB Free Tier) + Vercel (Hosting)

---

## Comandos Esenciales

```bash
# Desarrollo local
npm run dev

# Verificación de tipos estricta
npx tsc --noEmit

# Compilación de producción
npm run build

# Vista previa de build de producción
npm run preview
```

---

## Estándares de Arquitectura y Código

1. **Procesamiento de PDF Client-Side:**
   - La edición y el ensamblado de PDFs se ejecutan exclusivamente en el navegador usando `pdfjs-dist` y `pdf-lib`.
   - Todas las transformaciones geométricas entre el canvas de pantalla (*Top-Left*, píxeles) y el PDF (*Bottom-Left*, puntos tipográficos a 72 DPI) deben realizarse a través de `coordinateConverter.ts`.
2. **Seguridad y Sanitización (AppSec):**
   - Siempre verificar tipos MIME reales y cabeceras mágicas (Magic Bytes) con `security.ts`.
   - Toda entrada de imagen SVG debe pasar por `sanitizeSvgXml` para neutralizar inyecciones DOM XSS y ataques de bomba XML.
   - Todo texto exportado con fuentes estándar debe sanitizarse con `sanitizeWinAnsiText` para evitar excepciones por caracteres incompatibles.
3. **Gestión de Memoria y Web Workers:**
   - Invocación obligatoria de `page.cleanup()` y cancelación de `renderTask` activas al desmontar o re-renderizar componentes de canvas.
   - Desecho limpio de instancias de Fabric.js con `fCanvas.dispose()`.
   - Limpieza de `PDFDocumentProxy` al cambiar de archivo con `pdfDoc.destroy()`.
4. **Monetización con Stripe y Supabase:**
   - Las funciones serverless residen en `api/stripe/` para ser ejecutadas de forma nativa por Vercel.
   - El estado de la suscripción se sincroniza mediante webhooks en `api/stripe/webhook.ts` hacia la tabla `public.profiles` en Supabase.
