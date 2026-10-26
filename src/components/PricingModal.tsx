import React, { useState } from 'react';
import {
  X,
  Check,
  Crown,
  Sparkles,
  Zap,
  ShieldCheck,
  Infinity as InfinityIcon,
  Layers,
  ArrowRight,
  FileCheck,
} from 'lucide-react';
import { useAuthStore, FREE_DAILY_EXPORT_LIMIT, FREE_MAX_PAGE_COUNT, FREE_MAX_FILE_SIZE_MB } from '@/store/useAuthStore';
import { usePdfStore } from '@/store/usePdfStore';

export const PricingModal: React.FC = () => {
  const isPricingModalOpen = useAuthStore((s) => s.isPricingModalOpen);
  const closePricingModal = useAuthStore((s) => s.closePricingModal);
  const pricingReason = useAuthStore((s) => s.pricingReason);
  const createCheckoutSession = useAuthStore((s) => s.createCheckoutSession);
  const user = useAuthStore((s) => s.user);
  const openAuthModal = useAuthStore((s) => s.openAuthModal);
  const addToast = usePdfStore((s) => s.addToast);

  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual');
  const [isLoading, setIsLoading] = useState(false);

  if (!isPricingModalOpen) return null;

  const monthlyPriceId = import.meta.env.VITE_STRIPE_PRICE_ID_MONTHLY || 'price_monthly_sample';
  const annualPriceId = import.meta.env.VITE_STRIPE_PRICE_ID_ANNUAL || 'price_annual_sample';

  const handleSubscribe = async (tier: 'pro_monthly' | 'pro_annual') => {
    // Si no está autenticado, sugerir inicio de sesión para asociar la cuenta
    if (!user) {
      addToast('Te recomendamos registrarte primero para vincular tu suscripción a tu correo.', 'info');
      closePricingModal();
      openAuthModal();
      return;
    }

    try {
      setIsLoading(true);
      const priceId = tier === 'pro_annual' ? annualPriceId : monthlyPriceId;
      const { error } = await createCheckoutSession(priceId, tier);

      if (error) {
        addToast(error, 'error');
      }
    } catch (e: any) {
      addToast(e.message || 'Error al procesar pago', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[92vh]">
        {/* Header decoration */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-red-500 via-rose-500 to-amber-500" />

        {/* Close Button */}
        <button
          onClick={closePricingModal}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 md:p-8 overflow-y-auto">
          {/* Reason Alert Banner if triggered by quota/limit */}
          {pricingReason && (
            <div className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-start gap-3">
              <div className="p-1.5 bg-amber-100 text-amber-700 rounded-lg shrink-0 mt-0.5">
                <Zap className="w-4 h-4" />
              </div>
              <div className="text-xs md:text-sm text-amber-800">
                <span className="font-semibold">Límite alcanzado: </span>
                {pricingReason}
              </div>
            </div>
          )}

          {/* Title and subtitle */}
          <div className="text-center max-w-xl mx-auto mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-50 text-red-600 text-xs font-semibold mb-3">
              <Crown className="w-3.5 h-3.5" />
              Planes Flexibles para Todos
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
              Edita PDFs sin límites ni restricciones
            </h2>
            <p className="text-sm text-slate-500 mt-2">
              Elige el plan ideal para tus proyectos personales o profesionales. Cancela cuando quieras en 1 clic.
            </p>

            {/* Billing Switch */}
            <div className="inline-flex items-center gap-3 bg-slate-100 p-1.5 rounded-2xl mt-6">
              <button
                type="button"
                onClick={() => setBillingCycle('monthly')}
                className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  billingCycle === 'monthly'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Mensual
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle('annual')}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  billingCycle === 'annual'
                    ? 'bg-red-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>Anual</span>
                <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                  billingCycle === 'annual' ? 'bg-red-700 text-red-100' : 'bg-red-100 text-red-700'
                }`}>
                  Ahorra 20%
                </span>
              </button>
            </div>
          </div>

          {/* Plans Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {/* FREE PLAN */}
            <div className="p-6 rounded-2xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-slate-900 text-lg">Plan Gratuito</h3>
                  <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-200 text-slate-700">
                    Básico
                  </span>
                </div>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-3xl font-extrabold text-slate-900">$0</span>
                  <span className="text-xs text-slate-500 font-medium">para siempre</span>
                </div>

                <div className="space-y-3 text-xs text-slate-600">
                  <div className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Hasta <strong>{FREE_DAILY_EXPORT_LIMIT} descargas</strong> por día</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Hasta <strong>{FREE_MAX_PAGE_COUNT} páginas</strong> por documento</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Archivos de hasta <strong>{FREE_MAX_FILE_SIZE_MB} MB</strong></span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Herramientas estándar (Texto, Dibujo, Formas)</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-slate-400">
                    <X className="w-4 h-4 text-slate-300 shrink-0" />
                    <span className="line-through">Exportaciones ilimitadas</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={closePricingModal}
                className="mt-8 w-full py-2.5 px-4 rounded-xl text-xs font-semibold border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors"
              >
                Continuar con versión Gratuita
              </button>
            </div>

            {/* PRO PLAN */}
            <div className="relative p-6 rounded-2xl border-2 border-red-500 bg-white shadow-xl shadow-red-500/5 flex flex-col justify-between overflow-hidden">
              {/* Badge Popular */}
              <div className="absolute top-0 right-0 bg-red-600 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Más Popular
              </div>

              <div>
                <div className="flex items-center gap-2 mb-4">
                  <h3 className="font-bold text-slate-900 text-lg">RGDev Pro</h3>
                  <Crown className="w-4 h-4 text-amber-500 fill-amber-500" />
                </div>

                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-3xl font-extrabold text-slate-900">
                    {billingCycle === 'annual' ? '$3.99' : '$4.99'}
                  </span>
                  <span className="text-xs text-slate-500 font-medium">/ mes</span>
                </div>
                <div className="text-[11px] text-slate-400 mb-6">
                  {billingCycle === 'annual' ? 'Facturado anualmente ($47.88/año)' : 'Facturado mensualmente'}
                </div>

                <div className="space-y-3 text-xs text-slate-700">
                  <div className="flex items-center gap-2.5">
                    <div className="p-0.5 bg-red-100 text-red-600 rounded-full">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                    <span><strong>Descargas ilimitadas</strong> sin límite diario</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="p-0.5 bg-red-100 text-red-600 rounded-full">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                    <span><strong>Sin límite de páginas</strong> (hasta 150 páginas)</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="p-0.5 bg-red-100 text-red-600 rounded-full">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                    <span>Archivos gigantes de hasta <strong>100 MB</strong></span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="p-0.5 bg-red-100 text-red-600 rounded-full">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                    <span>Inserción de <strong>Imágenes en Ultra HD</strong></span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="p-0.5 bg-red-100 text-red-600 rounded-full">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                    <span>Soporte prioritario y portal de facturación en Stripe</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleSubscribe(billingCycle === 'annual' ? 'pro_annual' : 'pro_monthly')}
                disabled={isLoading}
                className="mt-8 w-full py-3 px-4 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-600/25 flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Actualizar a Pro</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Guarantee Badges */}
          <div className="mt-8 pt-6 border-t border-slate-100 flex flex-wrap items-center justify-center gap-6 text-slate-400 text-xs">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>Pagos 100% seguros procesados con Stripe</span>
            </div>
            <div className="flex items-center gap-1.5">
              <FileCheck className="w-4 h-4 text-blue-500" />
              <span>Cancela en cualquier momento sin compromisos</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
