import React, { useEffect, useRef, useState } from 'react';
import { LicensePlateReport } from '../types';

interface HeatMapProps {
  reports: LicensePlateReport[];
}

const HeatMap: React.FC<HeatMapProps> = ({ reports }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const infoWindowsRef = useRef<any[]>([]);
  const [mapsLoaded, setMapsLoaded] = useState(false);
  
  // Miami Center default
  const DEFAULT_LAT = 25.774;
  const DEFAULT_LNG = -80.133;

  // Load Google Maps script
  useEffect(() => {
    if (window.google?.maps) {
      setMapsLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      setMapsLoaded(true);
    };
    script.onerror = () => {
      console.error('Failed to load Google Maps');
    };
    document.head.appendChild(script);

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);

  // Initialize map when Google Maps is loaded
  useEffect(() => {
    if (!mapsLoaded || !mapContainerRef.current || !window.google?.maps) return;

    if (!mapRef.current) {
      // Initialize map
      mapRef.current = new window.google.maps.Map(mapContainerRef.current, {
        center: { lat: DEFAULT_LAT, lng: DEFAULT_LNG },
        zoom: 13,
        zoomControl: true, // Enable zoom controls
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        styles: [
          {
            featureType: 'poi',
            elementType: 'labels',
            stylers: [{ visibility: 'off' }]
          }
        ]
      });
    }

    // Clear existing markers and info windows
    markersRef.current.forEach(marker => marker.setMap(null));
    infoWindowsRef.current.forEach(infoWindow => infoWindow.close());
    markersRef.current = [];
    infoWindowsRef.current = [];

    // Custom marker icon (red circle)
    const markerIcon = {
      path: window.google.maps.SymbolPath.CIRCLE,
      scale: 8,
      fillColor: '#dc2626',
      fillOpacity: 1,
      strokeColor: '#ffffff',
      strokeWeight: 2,
    };

    const bounds = new window.google.maps.LatLngBounds();
    let hasMarkers = false;

    // Add markers for each report
    reports.forEach((report) => {
      if (report.coordinates) {
        const position = {
          lat: report.coordinates.lat,
          lng: report.coordinates.lng
        };

        const marker = new window.google.maps.Marker({
          position,
          map: mapRef.current,
          icon: markerIcon,
          title: report.plateText || 'Report'
        });

        // Create InfoWindow for marker details
        const infoWindow = new window.google.maps.InfoWindow({
          content: `
            <div style="padding: 8px;">
              <div style="font-weight: bold; font-size: 14px; margin-bottom: 4px;">
                ${report.plateText || 'Unknown Plate'}
              </div>
              ${report.address ? `<div style="font-size: 12px; color: #666;">${report.address}</div>` : ''}
            </div>
          `
        });

        // Add click listener to show InfoWindow
        marker.addListener('click', () => {
          // Close all other info windows
          infoWindowsRef.current.forEach(iw => iw.close());
          infoWindow.open(mapRef.current, marker);
        });

        markersRef.current.push(marker);
        infoWindowsRef.current.push(infoWindow);
        bounds.extend(position);
        hasMarkers = true;
      }
    });

    // Auto-fit bounds to show all markers
    if (hasMarkers && markersRef.current.length > 0) {
      // Add padding to bounds
      mapRef.current.fitBounds(bounds, {
        padding: 50
      });
    } else {
      // Default view if no markers
      mapRef.current.setCenter({ lat: DEFAULT_LAT, lng: DEFAULT_LNG });
      mapRef.current.setZoom(13);
    }
  }, [mapsLoaded, reports]);

  if (!mapsLoaded) {
    return (
      <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden mb-6">
        <div className="p-4 border-b border-zinc-100">
          <h3 className="text-sm font-bold text-zinc-900">Report Locations</h3>
          <p className="text-xs text-zinc-500">{reports.length} reports on map</p>
        </div>
        <div className="w-full h-64 bg-zinc-100 flex items-center justify-center">
          <div className="text-zinc-400 text-sm">Loading map...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden mb-6">
      <div className="p-4 border-b border-zinc-100">
        <h3 className="text-sm font-bold text-zinc-900">Report Locations</h3>
        <p className="text-xs text-zinc-500">{reports.length} reports on map</p>
      </div>
      <div 
        ref={mapContainerRef} 
        className="w-full h-64 bg-zinc-100 google-map-container"
        style={{ minHeight: '256px' }}
      />
    </div>
  );
};

export default HeatMap;
