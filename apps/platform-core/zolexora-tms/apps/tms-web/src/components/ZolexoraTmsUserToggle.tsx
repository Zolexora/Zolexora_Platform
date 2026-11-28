interface ZolexoraTmsUserToggleProps {
  entityLabel: 'Client' | 'Service Provider';
  isZolexoraUser: boolean;
  zolexoraOrgId?: string;
  onChange: (isZolexoraUser: boolean, zolexoraOrgId?: string) => void;
}

export function ZolexoraTmsUserToggle({
  entityLabel,
  isZolexoraUser,
  zolexoraOrgId,
  onChange,
}: ZolexoraTmsUserToggleProps) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 space-y-3">
      <div className="text-xs font-semibold text-slate-300">
        Is this {entityLabel} a Zolexora TMS user?
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={() => onChange(true, zolexoraOrgId)}
          className={`rounded-lg border px-3 py-2 text-xs font-semibold transition text-left ${
            isZolexoraUser
              ? 'border-cyan-500/60 bg-cyan-500/15 text-cyan-200'
              : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700 hover:text-white'
          }`}
        >
          <div>Yes — Zolexora TMS User</div>
          <div className="text-[10px] font-normal opacity-75 mt-0.5">Uses Zolexora platform</div>
        </button>
        <button
          type="button"
          onClick={() => onChange(false, undefined)}
          className={`rounded-lg border px-3 py-2 text-xs font-semibold transition text-left ${
            !isZolexoraUser
              ? 'border-navy-500/70 bg-navy-600/20 text-white'
              : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700 hover:text-white'
          }`}
        >
          <div>No — External</div>
          <div className="text-[10px] font-normal opacity-75 mt-0.5">Non-TMS / offline entity</div>
        </button>
      </div>

      {isZolexoraUser && (
        <div>
          <label className="block text-[11px] font-medium text-slate-400">
            Zolexora Org ID (optional)
          </label>
          <input
            type="text"
            value={zolexoraOrgId || ''}
            onChange={(e) => onChange(true, e.target.value.toUpperCase())}
            placeholder="e.g. ZX-ORG-XXXX-XXXX-XXXX"
            maxLength={64}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 font-mono text-xs text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none"
          />
        </div>
      )}
    </div>
  );
}
