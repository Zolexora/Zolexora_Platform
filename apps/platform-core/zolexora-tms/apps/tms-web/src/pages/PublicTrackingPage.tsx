import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Car, CheckCircle2, Clock, ExternalLink, MapPin, Navigation, RefreshCw, ShieldCheck } from 'lucide-react';
import { getApiBaseUrl } from '../lib/api';

interface PublicStop {
  seq: number;
  stop_type: string;
  address: string;
  status: string;
}

interface PublicTrackingData {
  trip_number: string;
  status: string;
  booking_type?: string | null;
  vehicle_registration?: string | null;
  driver_name?: string | null;
  pickup_address?: string | null;
  pickup_lat?: number | null;
  pickup_lng?: number | null;
  drop_address?: string | null;
  drop_lat?: number | null;
  drop_lng?: number | null;
  latest_latitude?: number | null;
  latest_longitude?: number | null;
  latest_location_at?: string | null;
  stops: PublicStop[];
  expires_at: string;
}

export function PublicTrackingPage() {
  const { token } = useParams<{ token: string }>();

  const { data, isLoading, error, refetch, isFetching } = useQuery<PublicTrackingData>({
    queryKey: ['public-tracking', token],
    queryFn: async () => {
      const res = await fetch(`${getApiBaseUrl()}/api/v1/tracking/public/${token}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || 'Tracking link invalid or expired');
      }
      return res.json();
    },
    enabled: !!token,
    refetchInterval: 10_000,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <div className="h-8 w-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-400">Loading live cab tracking...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center space-y-3">
          <ShieldCheck className="h-10 w-10 text-amber-400 mx-auto" />
          <h1 className="text-lg font-bold">Tracking Link Unavailable</h1>
          <p className="text-sm text-slate-400">
            {error instanceof Error ? error.message : 'This live tracking link may have expired or been revoked.'}
          </p>
        </div>
      </div>
    );
  }

  const hasCoords = data.latest_latitude != null && data.latest_longitude != null;
  const lat = data.latest_latitude ?? 0;
  const lng = data.latest_longitude ?? 0;
  const osmBbox = `${lng - 0.015}%2C${lat - 0.012}%2C${lng + 0.015}%2C${lat + 0.012}`;
  const osmUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${osmBbox}&layer=mapnik&marker=${lat}%2C${lng}`;
  const gmapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/90 p-5">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-400">
              <span>Zolexora Live Trip</span>
              {data.booking_type && (
                <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-[10px]">
                  {data.booking_type}
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold mt-1">{data.trip_number}</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {data.vehicle_registration ? `Vehicle ${data.vehicle_registration}` : 'Assigned Cab'}
              {data.driver_name ? ` · Chauffeur ${data.driver_name}` : ''}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-full border border-emerald-500/40 bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-300">
              {data.status.replace(/_/g, ' ')}
            </span>
            <button
              type="button"
              onClick={() => refetch()}
              aria-label="Refresh tracking"
              className="rounded-xl border border-slate-700 bg-slate-800 p-2 text-slate-300 hover:text-white transition"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Live Map Card */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 overflow-hidden">
          {hasCoords ? (
            <>
              <iframe
                title="Live Vehicle Location"
                src={osmUrl}
                className="w-full h-72 border-0"
                loading="lazy"
              />
              <div className="p-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800">
                <div className="text-xs text-slate-300 flex items-center gap-2">
                  <Navigation className="h-4 w-4 text-emerald-400" />
                  <span>
                    {lat.toFixed(5)}, {lng.toFixed(5)}
                  </span>
                  {data.latest_location_at && (
                    <span className="text-slate-400">
                      · Updated {new Date(data.latest_location_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
                <a
                  href={gmapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition"
                >
                  Open in Google Maps
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </>
          ) : (
            <div className="p-8 text-center text-sm text-slate-400 space-y-2">
              <Car className="h-8 w-8 mx-auto text-slate-500" />
              <p>Waiting for first GPS signal from the vehicle...</p>
            </div>
          )}
        </div>

        {/* Route Card */}
        {(data.pickup_address || data.drop_address) && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Route</h2>
            {data.pickup_address && (
              <div className="flex items-start gap-3">
                <MapPin className="h-4 w-4 text-indigo-400 mt-0.5 shrink-0" />
                <div>
                  <div className="text-[11px] font-bold uppercase text-slate-500">Pickup</div>
                  <div className="text-sm font-medium text-slate-100">{data.pickup_address}</div>
                </div>
              </div>
            )}
            {data.drop_address && (
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                <div>
                  <div className="text-[11px] font-bold uppercase text-slate-500">Drop</div>
                  <div className="text-sm font-medium text-slate-100">{data.drop_address}</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Stops / Boarding Roster */}
        {data.stops.length > 0 && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Boarding & Drop Stops ({data.stops.length})
            </h2>
            <div className="divide-y divide-slate-800">
              {[...data.stops]
                .sort((a, b) => a.seq - b.seq)
                .map((s) => (
                  <div key={s.seq} className="py-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-bold text-indigo-400 uppercase">
                        Stop #{s.seq} · {s.stop_type}
                      </div>
                      <div className="text-sm text-slate-200 mt-0.5">{s.address}</div>
                    </div>
                    <span className="rounded-full border border-slate-700 bg-slate-800 px-2.5 py-0.5 text-[11px] font-semibold text-slate-200">
                      {s.status}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500 pt-2">
          <Clock className="h-3.5 w-3.5" />
          <span>
            Auto-refreshes every 10s · Link valid until{' '}
            {new Date(data.expires_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
          </span>
        </div>
      </div>
    </div>
  );
}
