import React from 'react';
import { LicensePlateReport } from '../types';
import L from 'leaflet';
import { useEffect, useRef } from 'react';

interface HeatMapProps {
  reports: LicensePlateReport[];
}

const HeatMap: React.FC<HeatMapProps> = ({ reports }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapRef.current) {
      // Miami Center default
      const DEFAULT_LAT = 25.774;
      const DEFAULT_LNG = -80.133;

      mapRef.current = L.map(mapContainerRef.current, {
        center: [DEFAULT_LAT, DEFAULT_LNG],
        zoom: 13,
        zoomControl: false,
        attributionControl: false,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(mapRef.current);
    }

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // Add markers for each report
    reports.forEach((report) => {
      if (report.coordinates) {
        const icon = L.divIcon({
          className: 'bg-transparent',
          html: `<div class="w-4 h-4 bg-red-600 rounded-full border-2 border-white shadow-lg transform -translate-x-1/2 -translate-y-1/2"></div>`,
          iconSize: [0, 0],
        });

        const marker = L.marker(
          [report.coordinates.lat, report.coordinates.lng],
          { icon }
        ).addTo(mapRef.current!);

        marker.bindPopup(`<div class="text-xs font-bold">${report.plateText}</div>`);
        markersRef.current.push(marker);
      }
    });

    // Fix tiles on resize
    setTimeout(() => {
      mapRef.current?.invalidateSize();
    }, 100);
  }, [reports]);

  return (
    <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden mb-6">
      <div className="p-4 border-b border-zinc-100">
        <h3 className="text-sm font-bold text-zinc-900">Report Locations</h3>
        <p className="text-xs text-zinc-500">{reports.length} reports on map</p>
      </div>
      <div ref={mapContainerRef} className="w-full h-64 bg-zinc-100" />
    </div>
  );
};

export default HeatMap;





