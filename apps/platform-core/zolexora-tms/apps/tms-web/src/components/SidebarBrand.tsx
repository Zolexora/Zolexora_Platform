import { useEffect, useState } from 'react';
import { Truck } from 'lucide-react';

interface SidebarBrandProps {
  applicationName: string;
  logoUrl?: string | null;
  subtitle: string;
  subtitleClassName?: string;
}

/** Sidebar brand header with graceful icon fallback and safe wrapping for long tenant names. */
export function SidebarBrand({
  applicationName,
  logoUrl,
  subtitle,
  subtitleClassName = 'text-silver-500',
}: SidebarBrandProps) {
  const src = logoUrl || '/logo.png';
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [src]);

  return (
    <div className="flex min-h-16 items-center gap-3 border-b border-slate-800/80 px-5 py-3">
      {imgFailed ? (
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-700/80 bg-slate-800/80 text-cyan-400"
          aria-hidden="true"
        >
          <Truck className="h-5 w-5" />
        </div>
      ) : (
        <img
          src={src}
          alt={applicationName}
          onError={() => setImgFailed(true)}
          className="h-10 w-10 shrink-0 rounded-xl object-contain"
        />
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <span
          title={applicationName}
          className="line-clamp-2 text-sm font-bold leading-snug tracking-tight text-white"
        >
          {applicationName}
        </span>
        <span className={`mt-0.5 truncate text-[10px] font-medium uppercase tracking-widest ${subtitleClassName}`}>
          {subtitle}
        </span>
      </div>
    </div>
  );
}
