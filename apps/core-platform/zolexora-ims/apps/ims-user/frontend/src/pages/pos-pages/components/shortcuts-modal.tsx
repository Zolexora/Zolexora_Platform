import React from 'react';
import { Keyboard, X, Sparkles } from 'lucide-react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ShortcutsModal({ isOpen, onClose }: ShortcutsModalProps) {
  if (!isOpen) return null;

  const shortcuts = [
    { key: '/', desc: 'Focus Product Search / Barcode Scanner' },
    { key: 'Enter', desc: 'Add first matching item / Shortcode quick add' },
    { key: 'F8', desc: 'Hold / Park current active order' },
    { key: 'F9 or Ctrl+Enter', desc: 'Quick Pay & Print Customer Invoice' },
    { key: 'Alt+K', desc: 'Generate & Fire Kitchen Order Ticket (KOT)' },
    { key: 'Alt+T', desc: 'Toggle Table Management / Dine-In Floor' },
    { key: 'Alt+H', desc: 'Open Parked / Held Orders Drawer' },
    { key: 'Alt+R', desc: 'Open Recent Sales / Invoices Drawer' },
    { key: 'Alt+Q', desc: 'Generate Dynamic UPI QR Code' },
    { key: 'F4', desc: 'Reset & Clear Current Cart' },
    { key: 'Esc', desc: 'Close any open drawer, modal, or blur search' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-[#121420] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-4 bg-indigo-500/10 border-b border-indigo-500/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-white text-sm">High-Speed Keyboard Shortcuts</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Shortcuts List */}
        <div className="p-4 space-y-2 max-h-[70vh] overflow-y-auto">
          {shortcuts.map((s, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-2.5 bg-white/5 rounded-xl border border-white/5 hover:border-indigo-500/30 transition text-xs"
            >
              <span className="text-slate-300">{s.desc}</span>
              <kbd className="px-2 py-1 bg-black/40 border border-white/10 rounded-lg text-indigo-300 font-mono text-[11px] font-bold shadow-xs">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="p-3 bg-[#10121d] border-t border-white/10 text-center text-[11px] text-slate-400">
          Petpooja-compatible keyboard billing workflow enabled
        </div>
      </div>
    </div>
  );
}
