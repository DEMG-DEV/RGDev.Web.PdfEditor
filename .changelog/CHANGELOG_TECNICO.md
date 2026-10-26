# 📋 Registro Técnico de Cambios

> Documento generado automáticamente con cada commit realizado en el proyecto.
> Contiene el detalle técnico completo de cada cambio para el equipo de desarrollo.

---

## feat(release): release v1.0.0 - Clon de iLovePDF Editor con Stripe, Supabase y Vercel

| Campo | Detalle |
|-------|---------|
| **Fecha** | 2026-10-26 16:33:00 |
| **Autor** | David Mendez (demg@outlook.com) |
| **Branch** | `main` |
| **Tipo** | Feature / Initial Release |

### Archivos Modificados

| Archivo | Estado | Descripción del Cambio |
|---------|--------|----------------------|
| `src/components/Header.tsx` | Agregado | Barra superior con controles de zoom, Undo/Redo, descarga y UserMenu con integración de cuotas |
| `src/components/Toolbar.tsx` | Agregado | Barra de herramientas (Seleccionar, Texto, Imagen, Dibujo, Rectángulo, Círculo, Línea, Borrar) |
| `src/components/ToolOptionsBar.tsx` | Agregado | Barra contextual de estilos con tipografías, colores, grosores de trazo, opacidad y orden de capas |
| `src/components/Sidebar.tsx` | Agregado | Panel lateral con miniaturas reactivas, soporte Drag & Drop, rotación 90° y eliminación de páginas |
| `src/components/PdfCanvasPage.tsx` | Agregado | Doble capa: Canvas base de PDF.js acelerado por hardware + Canvas interactivo overlay de Fabric.js |
| `src/components/PdfViewer.tsx` | Agregado | Viewport principal con scroll vertical suave, soporte High-DPI y centrado de páginas |
| `src/components/UploadZone.tsx` | Agregado | Pantalla de inicio con Drag & Drop, validación de archivos, botón de PDF Demo y UserMenu |
| `src/components/PricingModal.tsx` | Agregado | Modal de precios y selección de planes Free vs Pro con toggle mensual/anual y enlace a Stripe Checkout |
| `src/components/AuthModal.tsx` | Agregado | Modal de autenticación con Email/Password y Google OAuth sobre Supabase |
| `src/components/UserMenu.tsx` | Agregado | Componente de estado de usuario con indicador de cuota diaria y botón para Stripe Portal |
| `src/services/pdfExporter.ts` | Agregado | Motor de exportación vectorial fiel con `pdf-lib`, soporte de rotaciones, autowrap y sanitización WinAnsi |
| `src/services/supabase.ts` | Agregado | Cliente singleton de Supabase con modo fallback seguro ante variables no configuradas |
| `src/store/usePdfStore.ts` | Agregado | Store centralizado con Zustand para documento, páginas, rotaciones, herramientas e historial diferencial |
| `src/store/useAuthStore.ts` | Agregado | Store de autenticación, perfil de usuario, control de cuotas y llamadas a funciones serverless de Stripe |
| `src/utils/coordinateConverter.ts` | Agregado | Fórmulas trigonométricas analíticas de conversión entre pantalla (px) y PDF (pt a 72 DPI) en 4 cuadrantes |
| `src/utils/security.ts` | Agregado | Validación de Magic Bytes (PDF, PNG, JPG, WebP), sanitización SVG contra DOM XSS y límites anti-DoS |
| `src/utils/pdfLoader.ts` | Agregado | Extractor asíncrono de páginas y dimensiones intrínsecas con PDF.js |
| `src/utils/demoPdf.ts` | Agregado | Generador en memoria de PDF de demostración enriquecido de 3 páginas para pruebas inmediatas |
| `api/stripe/checkout.ts` | Agregado | Función serverless de Vercel para crear sesiones de Stripe Checkout |
| `api/stripe/portal.ts` | Agregado | Función serverless de Vercel para crear sesiones de Stripe Customer Portal |
| `api/stripe/webhook.ts` | Agregado | Webhook de Stripe con verificación de firma y sincronización con tabla `profiles` de Supabase |
| `supabase/schema.sql` | Agregado | Esquema SQL de base de datos para Supabase (tabla profiles, RLS, triggers de cuotas) |
| `vercel.json` | Agregado | Configuración de enrutamiento SPA y serverless API en Vercel con cabeceras de seguridad |
| `.env.example` | Agregado | Plantilla exhaustiva de variables de entorno para Vercel, Supabase y Stripe |
| `docs/MONETIZATION_DEPLOYMENT_GUIDE.md` | Agregado | Guía completa paso a paso de despliegue en Vercel, Supabase y Stripe |

### Detalle Técnico

- **Procesamiento de PDF 100% en el Navegador:** El renderizado visual se gestiona mediante `pdfjs-dist` en un `<canvas>` base escalado por `devicePixelRatio`. Sobre él, una capa overlay gobernada por `fabric.Canvas` permite la interacción directa con objetos visuales.
- **Geometría y Transformación Analítica:** Las coordenadas de pantalla se mapean analíticamente a coordenadas nativas de PDF (puntos tipográficos a 72 DPI, origen inferior-izquierdo) soportando rotaciones de 0°, 90°, 180° y 270°. Las líneas vectoriales emplean la matriz de transformación de Fabric (`fabric.util.transformPoint`) para calcular sus puntos extremos exactos.
- **Seguridad AppSec:** Se implementó verificación estricta de cabeceras binarias (Magic Bytes) previniendo evasión de extensiones, sanitización con `DOMParser` para desarmar inyecciones en SVGs, transliteración WinAnsi para fuentes estándar de PDF y control de límites anti-DoS (máximo 150 páginas y 100 MB).
- **Monetización Serverless:** La integración con Stripe opera en endpoints serverless nativos de Vercel (`api/stripe/`), comunicándose con Supabase para mantener sincronizado el estado `is_pro` y las cuotas de descargas diarias.

---
