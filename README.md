# 📄 RGDev PDF Editor

[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Stripe](https://img.shields.io/badge/Stripe-Billing-008CDD?style=flat-square&logo=stripe&logoColor=white)](https://stripe.com/)
[![Supabase](https://img.shields.io/badge/Supabase-Database-3ECF8E?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com/)
[![Vercel](https://img.shields.io/badge/Vercel-Deployed-000000?style=flat-square&logo=vercel&logoColor=white)](https://vercel.com/)

**RGDev PDF Editor** es un clon moderno, privado y de alto rendimiento de [iLovePDF (Editar PDF)](https://www.ilovepdf.com/es/editar-pdf). Permite agregar texto, imágenes, dibujos libres y formas a documentos PDF con total fidelidad vectorial, ejecutándose **100% en el navegador del cliente** con coste de infraestructura cero para el renderizado y privacidad total.

Incluye un sistema completo de **monetización mediante Stripe**, base de datos y autenticación con **Supabase (Free Tier)** y despliegue serverless listo para **Vercel**.

---

## 📌 Punto de Referencia del Proyecto

| Versión | Commit / Estado | Fecha y Hora (UTC-6) | Descripción |
| :---: | :---: | :---: | :--- |
| **`v1.0.0`** | `Release Inicial` | 2026-10-26 16:32:00 | Lanzamiento oficial del editor con soporte Stripe, Supabase y Vercel |

---

## ✨ Características Principales

- **Edición Fiel en Tiempo Real:**
  - **Texto Enriquecido:** Tipografías estándar (Helvetica, Times, Courier), tamaños, colores, negrita, cursiva, alineación y soporte de textos multilínea con auto-wrap.
  - **Imágenes:** Subida de PNG, JPEG, WebP y SVG con redimensionado libre/proporcional, rotación, opacidad y orden de capas (Z-Index).
  - **Dibujo a Mano Alzada:** Trazo suave para firmas digitales y anotaciones manuales a resolución fija (144 DPI).
  - **Formas Vectoriales:** Rectángulos, círculos/elipses y líneas rectas con control de relleno, borde y grosor.
- **Gestión Avanzada de Páginas:**
  - Miniaturas sincronizadas en tiempo real con rotación intrínseca.
  - Reordenamiento visual de páginas mediante **Drag & Drop** o botones arriba/abajo.
  - Rotación individual de páginas en pasos de 90° con transformación rígida de anotaciones.
  - Eliminación segura de páginas individuales.
- **Seguridad de Nivel Empresarial (AppSec):**
  - Validación de Magic Bytes en subida de archivos (PNG, JPG, WebP, PDF).
  - Desarme y sanitización profunda contra DOM XSS y bombas XML en archivos SVG.
  - Sanitización de nombres de archivo contra Path Traversal y nombres reservados de Windows.
  - Protección anti-DoS limitando documentos a 150 páginas y 100 MB de memoria.
- **Monetización y Suscripciones (Stripe + Supabase):**
  - **Modelo Freemium:** 3 descargas gratis al día, hasta 10 páginas y 15 MB.
  - **Planes Pro ($4.99/mes o $3.99/mes anual):** Descargas ilimitadas, hasta 150 páginas y 100 MB.
  - **Portal de Facturación:** Gestión de tarjetas y cancelación automática vía Stripe Customer Portal.
  - **Autenticación:** Email/Password y Google OAuth conectados con Supabase Free Tier.

---

## 🚀 Inicio Rápido en Local

```bash
# 1. Clonar e instalar dependencias
npm install

# 2. Configurar variables de entorno (opcional para desarrollo local)
cp .env.example .env

# 3. Iniciar servidor de desarrollo
npm run dev
```

Abre [http://localhost:5173](http://localhost:5173) en tu navegador.

---

## 📦 Compilación y Producción

```bash
# Comprobación de tipos
npx tsc --noEmit

# Compilación optimizada
npm run build
```

---

## 🌐 Despliegue en Vercel

Consulta la guía detallada paso a paso en [docs/MONETIZATION_DEPLOYMENT_GUIDE.md](docs/MONETIZATION_DEPLOYMENT_GUIDE.md).
