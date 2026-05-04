"use client";
import { useEffect, useRef } from "react";
import L from "leaflet";

export default function Map({ ads }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) return;

    const map = L.map(ref.current).setView([50.0755, 14.4378], 6);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap",
    }).addTo(map);

    ads.forEach((ad) => {
      if (ad.lat && ad.lng) {
        // precise → blue pin
        if (ad.street) {
          const marker = L.circleMarker([ad.lat, ad.lng], {
            radius: 6,
            color: "blue",
            fillColor: "blue",
            fillOpacity: 0.9
          });
          marker.addTo(map);
        } else {
          // region → red circle
          L.circle([ad.lat, ad.lng], {
            radius: 2000,
            color: "red",
            fillOpacity: 0.3,
          }).addTo(map);
        }
      }
    });

    return () => map.remove();
  }, [ads]);

  return <div ref={ref} style={{ height: 250, borderRadius: 12 }} />;
}
