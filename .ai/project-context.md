# Checkpoint de Contexto del Proyecto: RGDev.Web.PdfEditor

> **Versión:** `v1.0.0 (Frontend & Serverless API)`  
> **Fecha:** 2026-10-26 (UTC-6)  
> **Estado:** Listo para Producción / Despliegue en Vercel

---

## 1. Visión General del Proyecto
**RGDev PDF Editor** es una plataforma web moderna de edición interactiva de PDFs inspirada en [iLovePDF (Editar PDF)](https://www.ilovepdf.com/es/editar-pdf). Se ejecuta bajo una arquitectura **100% Client-Side** para el procesamiento vectorial de documentos, garantizando coste cero de servidor de renderizado y privacidad total bajo normativas GDPR. Adicionalmente, cuenta con una capa serverless de monetización y suscripciones conectada con **Stripe** y **Supabase** (PostgreSQL Free Tier).

---

## 2. Pila Tecnológica (Stack)

- **Frontend Core:** React 18, Vite, TypeScript 5, Tailwind CSS, Lucide React, Zustand.
- **Motor de Renderizado PDF:** Mozilla PDF.js (`pdfjs-dist`) con soporte Web Workers ESM y pantallas High-DPI / Retina.
- **Motor de Lienzo Interactivo:** Fabric.js v6 (soporte de controles de transformación, rotación horaria, alineación y textos multilínea).
- **Motor de Inyección Vectorial y Exportación:** `pdf-lib` (reconstrucción nativa a 72 DPI, preservación de capas vectoriales, fuentes estándar y compresión en memoria).
- **Monetización & Suscripciones:** Stripe Billing & Checkout (`/api/stripe/checkout.ts`, `/api/stripe/portal.ts`, `/api/stripe/webhook.ts`).
- **Base de Datos y Autenticación:** Supabase (PostgreSQL 500 MB Free Tier, Auth con Email y Google OAuth, políticas RLS y triggers atómicos).
- **Despliegue & Hosting:** Vercel (Edge CDN + Serverless Functions en `/api/*` configurado vía `vercel.json`).

---

## 3. Arquitectura y Módulos Principales

```
RGDev.Web.PdfEditor/
├── api/stripe/                   # Funciones Serverless de Vercel (Stripe Checkout, Portal y Webhook)
├── supabase/schema.sql           # Esquema de base de datos Supabase (profiles, RLS, triggers)
├── docs/                         # Documentación de despliegue y monetización
├── src/
│   ├── types/                    # Tipos TypeScript para estado, herramientas y perfiles
│   ├── store/
│   │   ├── usePdfStore.ts        # Store de Zustand para lienzo, páginas, zoom e historial
│   │   └── useAuthStore.ts       # Store de Zustand para autenticación, límites y Stripe
│   ├── services/
│   │   ├── pdfExporter.ts        # Exportador vectorial fiel con pdf-lib y soporte de rotación
│   │   └── supabase.ts           # Cliente singleton de Supabase con fallback graceful
│   ├── utils/
│   │   ├── coordinateConverter.ts# Fórmulas geométricas pantalla <-> puntos PDF a 72 DPI
│   │   ├── security.ts           # Magic bytes (PDF/PNG/JPG/WebP), sanitización XSS SVG, anti-DoS
│   │   ├── pdfLoader.ts          # Carga asíncrona y extracción de viewports PDF.js
│   │   ├── pdfWorker.ts          # Configuración del worker de PDF.js
│   │   └── demoPdf.ts            # Generador en memoria de PDF de demostración (3 páginas)
│   └── components/
│       ├── Header.tsx            # Barra superior con título, zoom, Undo/Redo, UserMenu y descarga
│       ├── Toolbar.tsx           # Barra de herramientas (Seleccionar, Texto, Imagen, Dibujo, Formas)
│       ├── ToolOptionsBar.tsx    # Barra contextual de opciones de estilo (fuentes, colores, capas)
│       ├── Sidebar.tsx           # Miniaturas de páginas con Drag & Drop, rotación 90° y eliminación
│       ├── PdfCanvasPage.tsx     # Doble capa reactiva: Canvas PDF.js + Canvas Fabric.js
│       ├── PdfViewer.tsx         # Viewport principal con scroll vertical suave y centrado
│       ├── UploadZone.tsx        # Pantalla de bienvenida con Drag & Drop y carga de demo
│       ├── PricingModal.tsx      # Modal de precios y selección de planes Free / Pro Mensual / Pro Anual
│       ├── AuthModal.tsx         # Modal de autenticación con Email y Google OAuth
│       └── UserMenu.tsx          # Menú de usuario con estado de suscripción y accesos directos
```

---

## 4. Reglas de Negocio y Cuotas
- **Plan Gratuito:** Máximo 3 descargas por día, hasta 10 páginas por documento y 15 MB de tamaño.
- **Plan Pro ($4.99/mes o $3.99/mes facturado anual):** Descargas ilimitadas, hasta 150 páginas por documento y 100 MB de tamaño.
