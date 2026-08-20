import React, { useEffect } from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  Info, 
  AlertTriangle, 
  X,
  Sparkles,
  Copy,
  Trash2
} from 'lucide-react';

export function ToastItem({ toast, onDismiss }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, toast.duration || 3500);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  const getIcon = () => {
    if (toast.icon) return toast.icon;
    switch (toast.type) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-[#4ADE80] shrink-0" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-[#F87171] shrink-0" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-[#FBBF24] shrink-0" />;
      case 'copy':
        return <Copy className="w-4 h-4 text-[#38BDF8] shrink-0" />;
      case 'delete':
        return <Trash2 className="w-4 h-4 text-[#F87171] shrink-0" />;
      case 'info':
      default:
        return <Info className="w-4 h-4 text-[#38BDF8] shrink-0" />;
    }
  };

  const getBorderColor = () => {
    switch (toast.type) {
      case 'success':
        return 'border-l-[#2D7A53] border-[#2D7A53]/30';
      case 'error':
      case 'delete':
        return 'border-l-[#C93B2B] border-[#C93B2B]/30';
      case 'warning':
        return 'border-l-[#D97706] border-[#D97706]/30';
      case 'copy':
      case 'info':
      default:
        return 'border-l-[#38BDF8] border-[#38BDF8]/30';
    }
  };

  return (
    <div 
      className={`pointer-events-auto bg-[#1A1917] text-[#F4F1EA] border border-l-4 ${getBorderColor()} shadow-[6px_6px_0px_0px_rgba(0,0,0,0.85)] p-3 rounded-xs font-mono text-xs flex items-start gap-2.5 transition-all duration-300 animate-in slide-in-from-right-5 fade-in max-w-md w-full select-none`}
    >
      <div className="mt-0.5">{getIcon()}</div>
      
      <div className="flex-1 min-w-0 pr-1 space-y-0.5">
        {toast.title && (
          <div className="font-bold text-white tracking-wide text-[11px] uppercase flex items-center gap-1.5">
            <span>{toast.title}</span>
          </div>
        )}
        <div className="text-[#D1CEC7] text-[11.5px] leading-relaxed break-words font-sans">
          {toast.message}
        </div>
      </div>

      <button
        onClick={() => onDismiss(toast.id)}
        className="p-1 hover:bg-[#33312E] text-[#A09B8E] hover:text-white transition-colors rounded-xs shrink-0 cursor-pointer"
        title="Dismiss notification"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export default function ToastContainer({ toasts, onDismiss }) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem 
          key={toast.id} 
          toast={toast} 
          onDismiss={onDismiss} 
        />
      ))}
    </div>
  );
}
