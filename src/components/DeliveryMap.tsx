import { useEffect, useMemo, useState, useRef } from "react";
import { Clock3, MapPin, Navigation } from "lucide-react";

const DESTINATION_NAME = "Kisii University Main Gate";
const DESTINATION_LABEL = "Next to Kisii University Main Gate";
const DESTINATION_COORDS = { lat: -0.6742, lng: 34.7694 };

const toRad = (value: number) => (value * Math.PI) / 180;

const haversineDistanceKm = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
) => {
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const formatTime = (minutes: number) => {
  if (minutes < 1) return "less than a minute";
  if (minutes === 1) return "1 minute";
  const rounded = Math.round(minutes);
  return `${rounded} minutes`;
};

interface DeliveryMapProps {
  onDistanceChange?: (distance: number | null) => void;
  enabled?: boolean;
}

const DeliveryMap = ({ onDistanceChange, enabled = true }: DeliveryMapProps) => {
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const lastCallbackDistanceRef = useRef<number | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !navigator?.geolocation) {
      setGeoError("Geolocation is not available in this browser.");
      return;
    }

    const watcher = navigator.geolocation.watchPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setGeoError(null);
      },
      (error) => {
        setGeoError("Please allow location access to see the real-time route and arrival estimate.");
      },
      {
        enableHighAccuracy: false,
        timeout: 20000,
        maximumAge: 30000, // Increased to 30s to reduce update frequency
      },
    );

    return () => {
      navigator.geolocation.clearWatch(watcher);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  const distanceKm = useMemo(() => {
    if (!userLocation) return null;
    return haversineDistanceKm(
      userLocation.lat,
      userLocation.lng,
      DESTINATION_COORDS.lat,
      DESTINATION_COORDS.lng,
    );
  }, [userLocation]);

  // Debounce distance change callback to avoid excessive re-renders
  useEffect(() => {
    if (distanceKm === null) {
      if (lastCallbackDistanceRef.current !== null) {
        onDistanceChange?.(null);
        lastCallbackDistanceRef.current = null;
      }
      return;
    }

    // Only trigger callback if distance changed significantly (> 0.01 km or ~10m)
    const shouldUpdate = lastCallbackDistanceRef.current === null || 
      Math.abs(distanceKm - lastCallbackDistanceRef.current) > 0.01;
    
    if (shouldUpdate) {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        onDistanceChange?.(distanceKm);
        lastCallbackDistanceRef.current = distanceKm;
      }, 500); // 500ms debounce
    }
  }, [distanceKm, onDistanceChange]);

  const estimatedMinutes = useMemo(() => {
    if (distanceKm === null) return null;
    const travelSpeedKmh = 30;
    return Math.max(1, (distanceKm / travelSpeedKmh) * 60);
  }, [distanceKm]);

  const originParam = userLocation
    ? `${userLocation.lat},${userLocation.lng}`
    : "My+Location";

  const directionsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
    originParam,
  )}&destination=${encodeURIComponent(`${DESTINATION_NAME}, Kisii University`)}&travelmode=driving`;

  const embedUrl = `https://www.google.com/maps?q=${encodeURIComponent(
    `${DESTINATION_NAME}, Kisii University, Kenya`,
  )}&output=embed`;

  return (
    <div className={enabled ? "rounded-3xl border border-slate-800 bg-slate-950/95 p-4 shadow-card" : "hidden"}>
      <div className="flex items-start gap-3 mb-4">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#1a365d]/10 text-[#d69e2e]">
          <MapPin className="h-5 w-5" />
        </span>
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Live directions</p>
          <h3 className="text-lg font-semibold text-slate-100">Find us near Kisii University</h3>
          <p className="text-sm text-slate-400">{DESTINATION_LABEL}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-800">
        <iframe
          title="Kisii University directions"
          src={embedUrl}
          className="h-64 w-full border-0"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>

      <div className="mt-4 space-y-3 text-sm text-slate-300">
        <div className="flex items-center gap-2">
          <Navigation className="h-4 w-4 text-[#d69e2e]" />
          <span>{userLocation ? "Your location is visible." : "Allow location to calculate your arrival time."}</span>
        </div>
        {geoError && (
          <p className="text-xs text-amber-300">{geoError}</p>
        )}
        {distanceKm !== null && (
          <div className="rounded-2xl bg-slate-900/80 p-3 border border-slate-800">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Estimated arrival</p>
                <p className="text-lg font-semibold text-slate-100">
                  {formatTime(estimatedMinutes ?? 0)}
                </p>
              </div>
              <p className="text-right text-slate-400">~{distanceKm.toFixed(1)} km away</p>
            </div>
          </div>
        )}
      </div>

      <a
        href={directionsUrl}
        target="_blank"
        rel="noreferrer"
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#d69e2e] px-4 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-[#d69e2e]/20 transition hover:bg-[#efb22a]"
      >
        Open live route in Google Maps
      </a>
    </div>
  );
};

export default DeliveryMap;
