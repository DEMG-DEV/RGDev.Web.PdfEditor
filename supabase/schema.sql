-- ==============================================================================
-- RGDev PDF Editor - Esquema de Base de Datos para Supabase (Free Tier)
-- ==============================================================================
-- Este script configura la tabla de perfiles de usuario, sincronización con
-- Supabase Auth, políticas de seguridad RLS e índices para webhooks de Stripe.
-- ==============================================================================

-- 1. Crear tabla de perfiles de usuario
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  is_pro BOOLEAN DEFAULT FALSE NOT NULL,
  plan_tier TEXT DEFAULT 'free' NOT NULL, -- 'free' | 'pro_monthly' | 'pro_annual'
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT,
  subscription_status TEXT DEFAULT 'none' NOT NULL, -- 'none' | 'active' | 'trialing' | 'past_due' | 'canceled'
  daily_exports_count INT DEFAULT 0 NOT NULL,
  last_export_date DATE DEFAULT CURRENT_DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. Índices para acelerar búsquedas de Webhooks de Stripe y consultas por usuario
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer ON public.profiles(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_profiles_is_pro ON public.profiles(is_pro);

-- 3. Habilitar Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 4. Políticas de Acceso RLS:
-- Los usuarios autenticados pueden leer su propio perfil
CREATE POLICY "Users can read own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Los usuarios autenticados pueden actualizar campos no sensibles de su perfil
CREATE POLICY "Users can update own basic profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 5. Función y Trigger para crear automáticamente el perfil al registrarse en Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, is_pro, plan_tier, daily_exports_count, last_export_date)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    FALSE,
    'free',
    0,
    CURRENT_DATE
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Eliminar trigger previo si existe y recrear
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. Función para incrementar el contador de descargas diarias de forma atómica
CREATE OR REPLACE FUNCTION public.increment_daily_export(user_id UUID)
RETURNS JSONB AS $$
DECLARE
  current_count INT;
  is_user_pro BOOLEAN;
  today DATE := CURRENT_DATE;
BEGIN
  -- Obtener estado actual
  SELECT is_pro, 
         CASE WHEN last_export_date = today THEN daily_exports_count ELSE 0 END
  INTO is_user_pro, current_count
  FROM public.profiles
  WHERE id = user_id;

  -- Si es PRO, no hay límite
  IF is_user_pro THEN
    RETURN jsonb_build_object('allowed', TRUE, 'is_pro', TRUE, 'count', current_count);
  END IF;

  -- Si es Free y alcanzó el límite de 3
  IF current_count >= 3 THEN
    RETURN jsonb_build_object('allowed', FALSE, 'is_pro', FALSE, 'count', current_count, 'limit', 3);
  END IF;

  -- Incrementar contador
  UPDATE public.profiles
  SET daily_exports_count = current_count + 1,
      last_export_date = today,
      updated_at = NOW()
  WHERE id = user_id;

  RETURN jsonb_build_object('allowed', TRUE, 'is_pro', FALSE, 'count', current_count + 1, 'limit', 3);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
