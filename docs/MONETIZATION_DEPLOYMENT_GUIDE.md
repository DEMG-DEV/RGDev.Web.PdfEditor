# Guía Integral de Despliegue y Monetización (Vercel + Supabase + Stripe)

Este documento describe la arquitectura completa y las instrucciones paso a paso para poner en marcha el sistema de suscripciones de pago con **Stripe**, la base de datos y autenticación gratuita con **Supabase**, y el despliegue serverless en **Vercel**.

---

## 1. Arquitectura de Monetización

```
┌────────────────────────────────────────────────────────┐
│             FRONTEND SPA (Vercel Edge / CDN)           │
│  - Editor interactivo de PDFs (PDF.js + Fabric.js)     │
│  - Modal de Precios (Mensual $4.99 / Anual $3.99/mes)  │
│  - Modal de Autenticación (Email / Password / Google)  │
│  - Contador de descargas diarias (Free: 3 al día)      │
└──────────────────────────┬─────────────────────────────┘
                           │
       ┌───────────────────┴───────────────────┐
       ▼                                       ▼
┌──────────────────────────────┐   ┌──────────────────────────────┐
│  SUPABASE (Free Tier DB)     │   │ VERCEL SERVERLESS FUNCTIONS  │
│  - PostgreSQL 500 MB         │   │  /api/stripe/checkout.ts     │
│  - Supabase Auth (50K MAU)   │   │  /api/stripe/portal.ts       │
│  - Tabla public.profiles     │   │  /api/stripe/webhook.ts      │
│  - Trigger atómico de cuotas │   └──────────────┬───────────────┘
└──────────────────────────────┘                  │
                                                  ▼
                                   ┌──────────────────────────────┐
                                   │ STRIPE BILLING & CHECKOUT    │
                                   │  - Checkout Seguro           │
                                   │  - Tarjetas, Apple/Google Pay│
                                   │  - Customer Portal           │
                                   └──────────────────────────────┘
```

---

## 2. Paso a Paso: Configurar Supabase (Free Tier)

1. Ve a [supabase.com](https://supabase.com) y crea una cuenta gratuita.
2. Haz clic en **"New Project"**, asígnale un nombre (ej. `rgdev-pdf-editor`) y una contraseña para la base de datos.
3. En el menú lateral izquierdo, ve a **SQL Editor**.
4. Abre el archivo [`supabase/schema.sql`](file:///Users/davidmendez/LN/RGDev.Web.PdfEditor/supabase/schema.sql) de este proyecto, copia todo su contenido y pégalo en el editor SQL de Supabase.
5. Haz clic en **"Run"** para crear la tabla `public.profiles`, los triggers de nuevos usuarios y las funciones atómicas de control de descargas.
6. Ve a **Project Settings > API** y copia:
   - **Project URL** (`VITE_SUPABASE_URL`)
   - **anon public key** (`VITE_SUPABASE_ANON_KEY`)
   - **service_role secret** (`SUPABASE_SERVICE_ROLE_KEY`)

---

## 3. Paso a Paso: Configurar Stripe (Checkout & Portal)

1. Inicia sesión en tu cuenta de [Stripe](https://dashboard.stripe.com).
2. Asegúrate de estar en modo **Test Mode** (interruptor superior derecho).
3. Ve a **Product Catalog > Add Product**:
   - **Nombre:** `RGDev PDF Editor Pro`
   - **Precio 1 (Mensual):** `$4.99 USD` (Recurrente, mensual). Copia el Price ID (`price_...`).
   - **Precio 2 (Anual):** `$47.88 USD` (Recurrente, anual, equivalente a $3.99/mes). Copia el Price ID (`price_...`).
4. Ve a **Developers > API Keys** y copia:
   - **Secret key** (`STRIPE_SECRET_KEY`: `sk_test_...`)
5. Ve a **Settings > Billing > Customer Portal**:
   - Activa el portal de clientes para que los usuarios puedan gestionar sus métodos de pago o cancelar su suscripción directamente en Stripe.
6. **Configurar el Webhook de Stripe**:
   - Ve a **Developers > Webhooks > Add destination**.
   - **Endpoint URL:** `https://tu-proyecto.vercel.app/api/stripe/webhook` (o tu URL de ngrok en local).
   - **Eventos a escuchar:**
     - `checkout.session.completed`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_failed`
   - Una vez creado, haz clic en **"Reveal Signing Secret"** y copia el valor (`STRIPE_WEBHOOK_SECRET`: `whsec_...`).

---

## 4. Paso a Paso: Despliegue en Vercel

1. Sube tu código a GitHub o GitLab.
2. Ve a [vercel.com](https://vercel.com) e inicia sesión con GitHub.
3. Haz clic en **"Add New... > Project"** e importa el repositorio `RGDev.Web.PdfEditor`.
4. Vercel detectará automáticamente la configuración gracias a nuestro archivo [`vercel.json`](file:///Users/davidmendez/LN/RGDev.Web.PdfEditor/vercel.json).
5. En la sección **Environment Variables**, añade:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `VITE_STRIPE_PRICE_ID_MONTHLY`
   - `VITE_STRIPE_PRICE_ID_ANNUAL`
   - `VITE_APP_URL` (la URL generada por Vercel, ej. `https://tu-proyecto.vercel.app`)
6. Haz clic en **"Deploy"**. En menos de 1 minuto tu aplicación estará en vivo con HTTPS global, CDN ultra rápida y funciones serverless operativas.

---

## 5. Reglas de Negocio Implementadas (Paywall)

| Característica | Plan Gratuito (Free) | Plan Pro ($4.99/mes o $3.99/mes) |
| :--- | :--- | :--- |
| **Descargas Diarias** | **3 descargas por día** | **Ilimitadas** |
| **Límite de Páginas** | Hasta **10 páginas** por documento | Hasta **150 páginas** |
| **Tamaño de Archivo** | Hasta **15 MB** | Hasta **100 MB** |
| **Imágenes y Dibujo** | Estándar | Ultra HD sin pérdida |
| **Facturación** | $0 para siempre | Cancelación en 1 clic vía Stripe Portal |

Si un usuario gratuito intenta superar cualquiera de estos límites, el sistema abre automáticamente el modal de planes para mejorar a Pro.
