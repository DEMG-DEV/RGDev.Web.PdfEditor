import { create } from 'zustand';
import { supabase, isSupabaseConfigured } from '@/services/supabase';
import type { User } from '@supabase/supabase-js';

export const FREE_DAILY_EXPORT_LIMIT = 3;
export const FREE_MAX_PAGE_COUNT = 10;
export const FREE_MAX_FILE_SIZE_MB = 15;

export interface UserProfile {
  id: string;
  email?: string;
  fullName?: string;
  isPro: boolean;
  planTier: 'free' | 'pro_monthly' | 'pro_annual';
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionStatus: 'none' | 'active' | 'trialing' | 'past_due' | 'canceled';
  dailyExportsCount: number;
  lastExportDate: string;
}

interface ExportCheckResult {
  allowed: boolean;
  reason?: string;
}

interface AuthStoreState {
  user: User | null;
  profile: UserProfile | null;
  isLoading: boolean;
  isAuthModalOpen: boolean;
  isPricingModalOpen: boolean;
  pricingReason: string;

  // Local storage counters for guest/free users
  guestExportsCount: number;
  guestLastExportDate: string;

  // Modals
  openAuthModal: () => void;
  closeAuthModal: () => void;
  openPricingModal: (reason?: string) => void;
  closePricingModal: () => void;

  // Auth actions
  initAuth: () => Promise<void>;
  fetchProfile: (userId: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<{ error?: string }>;
  signUpWithEmail: (email: string, password: string, fullName?: string) => Promise<{ error?: string }>;
  signInWithGoogle: () => Promise<{ error?: string }>;
  signOut: () => Promise<void>;

  // Usage & Quota enforcement
  canExport: (pageCount?: number, fileSizeBytes?: number) => ExportCheckResult;
  recordExport: () => Promise<void>;

  // Billing Actions
  createCheckoutSession: (priceId: string, planTier: 'pro_monthly' | 'pro_annual') => Promise<{ url?: string; error?: string }>;
  openBillingPortal: () => Promise<{ url?: string; error?: string }>;
}

const getTodayString = () => new Date().toISOString().split('T')[0];

const getStoredGuestUsage = () => {
  try {
    const today = getTodayString();
    const storedDate = localStorage.getItem('rgdev_pdf_guest_date') || today;
    const storedCount = parseInt(localStorage.getItem('rgdev_pdf_guest_count') || '0', 10);

    if (storedDate !== today) {
      localStorage.setItem('rgdev_pdf_guest_date', today);
      localStorage.setItem('rgdev_pdf_guest_count', '0');
      return { date: today, count: 0 };
    }
    return { date: storedDate, count: storedCount };
  } catch {
    return { date: getTodayString(), count: 0 };
  }
};

export const useAuthStore = create<AuthStoreState>((set, get) => {
  const initialGuest = getStoredGuestUsage();

  return {
    user: null,
    profile: null,
    isLoading: true,
    isAuthModalOpen: false,
    isPricingModalOpen: false,
    pricingReason: '',
    guestExportsCount: initialGuest.count,
    guestLastExportDate: initialGuest.date,

    openAuthModal: () => set({ isAuthModalOpen: true }),
    closeAuthModal: () => set({ isAuthModalOpen: false }),

    openPricingModal: (reason = '') => set({ isPricingModalOpen: true, pricingReason: reason }),
    closePricingModal: () => set({ isPricingModalOpen: false, pricingReason: '' }),

    initAuth: async () => {
      if (!supabase || !isSupabaseConfigured) {
        set({ isLoading: false });
        return;
      }

      try {
        set({ isLoading: true });
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
          set({ user: session.user });
          await get().fetchProfile(session.user.id);
        }

        // Listener de cambios de autenticación
        supabase.auth.onAuthStateChange(async (_event, newSession) => {
          if (newSession?.user) {
            set({ user: newSession.user });
            await get().fetchProfile(newSession.user.id);
          } else {
            set({ user: null, profile: null });
          }
        });
      } catch (err) {
        console.warn('Error inicializando autenticación con Supabase:', err);
      } finally {
        set({ isLoading: false });
      }
    },

    fetchProfile: async (userId: string) => {
      if (!supabase) return;

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.warn('Error al obtener perfil:', error);
          return;
        }

        if (data) {
          const today = getTodayString();
          const dailyCount = data.last_export_date === today ? (data.daily_exports_count || 0) : 0;

          set({
            profile: {
              id: data.id,
              email: data.email,
              fullName: data.full_name,
              isPro: Boolean(data.is_pro),
              planTier: data.plan_tier || 'free',
              stripeCustomerId: data.stripe_customer_id,
              stripeSubscriptionId: data.stripe_subscription_id,
              subscriptionStatus: data.subscription_status || 'none',
              dailyExportsCount: dailyCount,
              lastExportDate: data.last_export_date || today,
            },
          });
        }
      } catch (err) {
        console.warn('Fallo al consultar perfil de Supabase:', err);
      }
    },

    signInWithEmail: async (email, password) => {
      if (!supabase || !isSupabaseConfigured) {
        return { error: 'Supabase no está configurado aún en las variables de entorno.' };
      }
      try {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) return { error: error.message };
        set({ isAuthModalOpen: false });
        return {};
      } catch (e: any) {
        return { error: e.message || 'Error al iniciar sesión' };
      }
    },

    signUpWithEmail: async (email, password, fullName) => {
      if (!supabase || !isSupabaseConfigured) {
        return { error: 'Supabase no está configurado aún.' };
      }
      try {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName || '',
            },
          },
        });
        if (error) return { error: error.message };
        set({ isAuthModalOpen: false });
        return {};
      } catch (e: any) {
        return { error: e.message || 'Error al registrar usuario' };
      }
    },

    signInWithGoogle: async () => {
      if (!supabase || !isSupabaseConfigured) {
        return { error: 'Supabase no está configurado aún.' };
      }
      try {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: window.location.origin,
          },
        });
        if (error) return { error: error.message };
        return {};
      } catch (e: any) {
        return { error: e.message || 'Error con Google Auth' };
      }
    },

    signOut: async () => {
      if (supabase) {
        await supabase.auth.signOut();
      }
      set({ user: null, profile: null });
    },

    canExport: (pageCount = 1, fileSizeBytes = 0) => {
      const { profile, guestExportsCount } = get();

      // 1. Si el usuario es PRO, acceso total sin restricciones
      if (profile?.isPro) {
        return { allowed: true };
      }

      // 2. Comprobar número de páginas (Free límite: 10 páginas)
      if (pageCount > FREE_MAX_PAGE_COUNT) {
        return {
          allowed: false,
          reason: `El plan gratuito permite hasta ${FREE_MAX_PAGE_COUNT} páginas. Tu documento tiene ${pageCount} páginas. Actualiza a PRO para procesar documentos ilimitados.`,
        };
      }

      // 3. Comprobar tamaño de archivo (Free límite: 15 MB)
      const fileSizeMb = fileSizeBytes / (1024 * 1024);
      if (fileSizeMb > FREE_MAX_FILE_SIZE_MB) {
        return {
          allowed: false,
          reason: `El archivo (${fileSizeMb.toFixed(1)} MB) excede el límite gratuito de ${FREE_MAX_FILE_SIZE_MB} MB. Actualiza a PRO para subir archivos de hasta 100 MB.`,
        };
      }

      // 4. Comprobar cuota diaria (Free límite: 3 descargas por día)
      const currentCount = profile ? profile.dailyExportsCount : guestExportsCount;
      if (currentCount >= FREE_DAILY_EXPORT_LIMIT) {
        return {
          allowed: false,
          reason: `Has utilizado tus ${FREE_DAILY_EXPORT_LIMIT} descargas gratuitas de hoy. Actualiza a PRO para disfrutar de exportaciones ilimitadas.`,
        };
      }

      return { allowed: true };
    },

    recordExport: async () => {
      const { user, profile } = get();
      const today = getTodayString();

      // Si es usuario registrado
      if (user && supabase) {
        try {
          // Invocar función RPC atómica en Supabase
          await supabase.rpc('increment_daily_export', { user_id: user.id });
          await get().fetchProfile(user.id);
        } catch {
          // Fallback a actualización directa
          if (profile) {
            const nextCount = (profile.lastExportDate === today ? profile.dailyExportsCount : 0) + 1;
            await supabase
              .from('profiles')
              .update({
                daily_exports_count: nextCount,
                last_export_date: today,
              })
              .eq('id', user.id);
            set({
              profile: {
                ...profile,
                dailyExportsCount: nextCount,
                lastExportDate: today,
              },
            });
          }
        }
      } else {
        // Usuario invitado (Guest): almacenar en localStorage
        try {
          const current = getStoredGuestUsage();
          const nextCount = current.count + 1;
          localStorage.setItem('rgdev_pdf_guest_count', nextCount.toString());
          localStorage.setItem('rgdev_pdf_guest_date', today);
          set({ guestExportsCount: nextCount, guestLastExportDate: today });
        } catch {
          // ignore localStorage error
        }
      }
    },

    createCheckoutSession: async (priceId: string, planTier: 'pro_monthly' | 'pro_annual') => {
      const { user, profile } = get();

      try {
        const response = await fetch('/api/stripe/checkout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            priceId,
            planTier,
            returnUrl: window.location.origin,
            userId: user?.id,
            userEmail: user?.email,
            customerId: profile?.stripeCustomerId,
          }),
        });

        const data = await response.json();

        if (!response.ok || data.error) {
          return { error: data.error || 'Error al iniciar checkout con Stripe.' };
        }

        if (data.url) {
          window.location.href = data.url;
          return { url: data.url };
        }

        return { error: 'No se recibió la URL de Stripe Checkout.' };
      } catch (err: any) {
        return { error: err.message || 'Error de conexión con el servidor de pagos.' };
      }
    },

    openBillingPortal: async () => {
      const { profile } = get();
      if (!profile?.stripeCustomerId) {
        return { error: 'No se encontró un identificador de cliente en Stripe.' };
      }

      try {
        const response = await fetch('/api/stripe/portal', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            customerId: profile.stripeCustomerId,
            returnUrl: window.location.origin,
          }),
        });

        const data = await response.json();

        if (!response.ok || data.error) {
          return { error: data.error || 'No se pudo abrir el portal de facturación.' };
        }

        if (data.url) {
          window.location.href = data.url;
          return { url: data.url };
        }

        return { error: 'No se recibió la URL del portal.' };
      } catch (err: any) {
        return { error: err.message || 'Error al conectar con Stripe Portal.' };
      }
    },
  };
});
