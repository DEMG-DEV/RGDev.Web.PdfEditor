import React, { useState, useRef, useEffect } from 'react';
import {
  Crown,
  User,
  LogOut,
  CreditCard,
  Sparkles,
  ChevronDown,
  Zap,
} from 'lucide-react';
import { useAuthStore, FREE_DAILY_EXPORT_LIMIT } from '@/store/useAuthStore';
import { usePdfStore } from '@/store/usePdfStore';

export const UserMenu: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const openAuthModal = useAuthStore((s) => s.openAuthModal);
  const openPricingModal = useAuthStore((s) => s.openPricingModal);
  const openBillingPortal = useAuthStore((s) => s.openBillingPortal);
  const signOut = useAuthStore((s) => s.signOut);
  const guestExportsCount = useAuthStore((s) => s.guestExportsCount);
  const addToast = usePdfStore((s) => s.addToast);

  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isPro = profile?.isPro;
  const currentCount = profile ? profile.dailyExportsCount : guestExportsCount;
  const remainingFree = Math.max(0, FREE_DAILY_EXPORT_LIMIT - currentCount);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePortal = async () => {
    setIsOpen(false);
    addToast('Redirigiendo al portal seguro de Stripe...', 'info');
    const { error } = await openBillingPortal();
    if (error) {
      addToast(error, 'error');
    }
  };

  return (
    <div className="relative flex items-center gap-2" ref={menuRef}>
      {/* Upgrade to Pro Button (always visible if not pro) */}
      {!isPro && (
        <button
          type="button"
          onClick={() => openPricingModal()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 hover:from-red-700 hover:to-amber-700 text-white text-xs font-bold shadow-xs hover:shadow-md transition-all active:scale-95"
          title="Ver planes y desbloquear descargas ilimitadas"
        >
          <Crown className="w-3.5 h-3.5 fill-white" />
          <span className="hidden sm:inline">Hazte PRO</span>
        </button>
      )}

      {/* User Button */}
      {user ? (
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-2 p-1.5 pr-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors text-slate-700 text-xs font-medium"
          >
            <div className="w-6 h-6 rounded-lg bg-red-100 text-red-700 flex items-center justify-center font-bold text-[11px]">
              {profile?.fullName ? profile.fullName.charAt(0).toUpperCase() : user.email?.charAt(0).toUpperCase()}
            </div>
            <span className="max-w-[100px] truncate hidden md:inline">
              {profile?.fullName || user.email?.split('@')[0]}
            </span>

            {/* Badge */}
            {isPro ? (
              <span className="px-1.5 py-0.5 rounded-md text-[9px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-0.5">
                <Crown className="w-2.5 h-2.5 fill-amber-700" />
                PRO
              </span>
            ) : (
              <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-slate-100 text-slate-600">
                FREE
              </span>
            )}

            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {/* Dropdown */}
          {isOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-100 p-2 z-50 animate-in fade-in slide-in-from-top-1">
              <div className="px-3 py-2 border-b border-slate-100">
                <div className="text-xs font-semibold text-slate-900 truncate">
                  {profile?.fullName || 'Usuario'}
                </div>
                <div className="text-[11px] text-slate-500 truncate">{user.email}</div>

                {/* Status card inside dropdown */}
                <div className="mt-2.5 p-2 rounded-xl bg-slate-50 border border-slate-200/70 text-[11px]">
                  {isPro ? (
                    <div className="flex items-center gap-1.5 text-amber-800 font-semibold">
                      <Crown className="w-3.5 h-3.5 fill-amber-600 text-amber-600" />
                      <span>Suscripción PRO Activa</span>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between text-slate-600">
                        <span className="flex items-center gap-1">
                          <Zap className="w-3 h-3 text-amber-500" />
                          Descargas hoy:
                        </span>
                        <span className="font-bold text-slate-800">
                          {remainingFree} de {FREE_DAILY_EXPORT_LIMIT} libres
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 h-1.5 rounded-full mt-1.5 overflow-hidden">
                        <div
                          className="bg-red-500 h-full rounded-full transition-all"
                          style={{ width: `${(currentCount / FREE_DAILY_EXPORT_LIMIT) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="py-1">
                {!isPro ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      openPricingModal();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-xl transition-colors text-left"
                  >
                    <Sparkles className="w-4 h-4 text-red-500" />
                    <span>Mejorar a RGDev Pro</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handlePortal}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 rounded-xl transition-colors text-left"
                  >
                    <CreditCard className="w-4 h-4 text-slate-400" />
                    <span>Gestionar Suscripción (Stripe)</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    signOut();
                    addToast('Sesión cerrada.', 'info');
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors text-left"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Cerrar Sesión</span>
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={openAuthModal}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors"
        >
          <User className="w-3.5 h-3.5 text-slate-500" />
          <span>Acceder</span>
        </button>
      )}
    </div>
  );
};
