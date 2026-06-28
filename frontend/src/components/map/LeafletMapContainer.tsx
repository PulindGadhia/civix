import React, { useEffect, useRef, useState } from 'react';
import { Navigation, Search, Flame, Compass, Maximize2, Minimize2, Cpu } from 'lucide-react';
import L from 'leaflet';
import axios from 'axios';

import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';

// Load Leaflet marker cluster, heat, and Geoman drawing plugins
import 'leaflet.markercluster';
import 'leaflet.heat';
import '@geoman-io/leaflet-geoman-free';

import type { Issue } from '../../App';

interface AddressDetails {
  rawAddress: string;
  houseNumber: string;
  street: string;
  area: string;
  locality: string;
  landmark: string;
  city: string;
  district: string;
  state: string;
  country: string;
  pincode: string;
}

interface LeafletMapContainerProps {
  issues: Issue[];
  selectedLocation: { lat: number; lng: number } | null;
  onLocationSelected: (lat: number, lng: number, addressDetails: AddressDetails) => void;
  onMarkerClick: (issue: Issue) => void;
}

interface Suggestion {
  name: string;
  lat: number;
  lng: number;
  state: string;
  pincode: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rawDetails?: any;
}

const MOCK_LOCATIONS = [
  { name: 'Mumbai, Maharashtra, India', lat: 19.0760, lng: 72.8777, state: 'Maharashtra', pincode: '400001' },
  { name: 'Delhi, NCT, India', lat: 28.6139, lng: 77.2090, state: 'Delhi', pincode: '110001' },
  { name: 'Bengaluru, Karnataka, India', lat: 12.9716, lng: 77.5946, state: 'Karnataka', pincode: '560001' },
  { name: 'Ahmedabad, Gujarat, India', lat: 23.0225, lng: 72.5714, state: 'Gujarat', pincode: '380009' },
  { name: 'Kolkata, West Bengal, India', lat: 22.5726, lng: 88.3639, state: 'West Bengal', pincode: '700001' },
  { name: 'Chennai, Tamil Nadu, India', lat: 13.0827, lng: 80.2707, state: 'Tamil Nadu', pincode: '600001' },
  { name: 'Hyderabad, Telangana, India', lat: 17.3850, lng: 78.4867, state: 'Telangana', pincode: '500001' },
  { name: 'Pune, Maharashtra, India', lat: 18.5204, lng: 73.8567, state: 'Maharashtra', pincode: '411001' },
  { name: 'Jaipur, Rajasthan, India', lat: 26.9124, lng: 75.7873, state: 'Rajasthan', pincode: '302001' },
  { name: 'Surat, Gujarat, India', lat: 21.1702, lng: 72.8311, state: 'Gujarat', pincode: '395003' },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const parseNominatimAddress = (data: any): AddressDetails => {
  const address = data.address || {};
  const city = address.city || address.town || address.municipality || address.village || address.city_district || address.locality || '';
  const district = address.county || address.district || address.state_district || '';
  const locality = address.suburb || address.neighbourhood || address.locality || address.quarter || '';
  const area = address.subdistrict || address.residential || address.village || address.neighbourhood || '';
  const state = address.state || address.region || '';

  return {
    rawAddress: data.display_name || '',
    houseNumber: address.house_number || '',
    street: address.road || address.pedestrian || '',
    area,
    locality,
    landmark: address.amenity || address.shop || address.building || '',
    city,
    district,
    state,
    country: address.country || '',
    pincode: address.postcode || '',
  };
};

// Spherical ring area helper function (in square meters)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getPolygonArea = (latlngs: any[]): number => {
  let area = 0;
  const points = Array.isArray(latlngs[0]) ? latlngs[0] : latlngs;
  if (points.length > 2) {
    const R = 6378137; // Earth's radius in meters
    for (let i = 0; i < points.length; i++) {
      const p1 = points[i];
      const p2 = points[(i + 1) % points.length];
      const radLat1 = (p1.lat * Math.PI) / 180;
      const radLat2 = (p2.lat * Math.PI) / 180;
      const radLng1 = (p1.lng * Math.PI) / 180;
      const radLng2 = (p2.lng * Math.PI) / 180;
      area += (radLng2 - radLng1) * (2 + Math.sin(radLat1) + Math.sin(radLat2));
    }
    area = Math.abs((area * R * R) / 2.0);
  }
  return area;
};

// Line length helper function (in meters)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getLineLength = (latlngs: any[]): number => {
  let length = 0;
  const points = Array.isArray(latlngs[0]) ? latlngs[0] : latlngs;
  for (let i = 0; i < points.length - 1; i++) {
    length += points[i].distanceTo(points[i + 1]);
  }
  return length;
};

export const LeafletMapContainer: React.FC<LeafletMapContainerProps> = ({
  issues,
  selectedLocation,
  onLocationSelected,
  onMarkerClick,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const fullscreenContainerRef = useRef<HTMLDivElement>(null);
  const miniMapContainerRef = useRef<HTMLDivElement>(null);

  const mapRef = useRef<L.Map | null>(null);
  const miniMapRef = useRef<L.Map | null>(null);
  const selectionMarkerRef = useRef<L.Marker | null>(null);
  const gpsMarkerRef = useRef<L.Marker | null>(null);
  const gpsCircleRef = useRef<L.Circle | null>(null);
  const clusterGroupRef = useRef<L.MarkerClusterGroup | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const heatLayerRef = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [mapType, setMapType] = useState<'roadmap' | 'satellite' | 'dark' | 'light' | 'topo' | 'terrain'>('roadmap');
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showAiOverlay, setShowAiOverlay] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [gpsLocation, setGpsLocation] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [mouseCoords, setMouseCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Define switchable layers inside refs with performance settings
  const roadmapLayer = useRef(
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors, © CartoDB',
      updateWhenIdle: true,
      keepBuffer: 2
    })
  );

  const satelliteLayer = useRef(
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      attribution: 'Tiles &copy; Esri',
      updateWhenIdle: true,
      keepBuffer: 2
    })
  );

  const darkLayer = useRef(
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors, © CartoDB',
      updateWhenIdle: true,
      keepBuffer: 2
    })
  );

  const lightLayer = useRef(
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors, © CartoDB',
      updateWhenIdle: true,
      keepBuffer: 2
    })
  );

  const topoLayer = useRef(
    L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      maxZoom: 17,
      attribution: 'Map data: &copy; OpenStreetMap contributors',
      updateWhenIdle: true,
      keepBuffer: 2
    })
  );

  const terrainLayer = useRef(
    L.layerGroup([
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Terrain_Base/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 13,
        updateWhenIdle: true,
        keepBuffer: 2
      }),
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        opacity: 0.8,
        updateWhenIdle: true,
        keepBuffer: 2
      })
    ])
  );

  const onLocationSelectedRef = useRef(onLocationSelected);
  const onMarkerClickRef = useRef(onMarkerClick);

  useEffect(() => {
    onLocationSelectedRef.current = onLocationSelected;
    onMarkerClickRef.current = onMarkerClick;
  });

  // Fullscreen State Sync Listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      if (mapRef.current) {
        setTimeout(() => {
          mapRef.current?.invalidateSize();
        }, 120);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const fallbackGeocode = (lat: number, lng: number) => {
    const mockDetails: AddressDetails = {
      rawAddress: `Point coordinates: [${lat.toFixed(5)}, ${lng.toFixed(5)}]`,
      houseNumber: '',
      street: 'Main Roadway',
      area: 'District Area',
      locality: 'Mock Locality',
      landmark: '',
      city: 'Rajkot',
      district: 'Rajkot District',
      state: 'Gujarat',
      country: 'India',
      pincode: '360001',
    };
    setSearchQuery(mockDetails.rawAddress);
    onLocationSelectedRef.current(lat, lng, mockDetails);
  };

  // Geocoding and Location Selected
  const handleMapSelect = async (lat: number, lng: number) => {
    try {
      const response = await axios.get(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`
      );
      const addressDetails = parseNominatimAddress(response.data);
      setSearchQuery(addressDetails.rawAddress);
      onLocationSelectedRef.current(lat, lng, addressDetails);

      if (mapRef.current) {
        mapRef.current.panTo([lat, lng]);
      }
    } catch (e) {
      console.warn('Reverse geocoding failed, using fallback:', e);
      fallbackGeocode(lat, lng);
    }
  };

  const handleMapSelectRef = useRef(handleMapSelect);
  useEffect(() => {
    handleMapSelectRef.current = handleMapSelect;
  });

  // Track Mouse Hover Coordinates
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const handleMouseMove = (e: L.LeafletMouseEvent) => {
      setMouseCoords(e.latlng);
    };
    map.on('mousemove', handleMouseMove);
    return () => {
      map.off('mousemove', handleMouseMove);
    };
  }, [mapType]); // reset listener when layers change

  // Sync GPS Location indicator
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (gpsCircleRef.current) {
      map.removeLayer(gpsCircleRef.current);
      gpsCircleRef.current = null;
    }
    if (gpsMarkerRef.current) {
      map.removeLayer(gpsMarkerRef.current);
      gpsMarkerRef.current = null;
    }

    if (gpsLocation) {
      // Pulse Circle for accuracy bounds
      gpsCircleRef.current = L.circle([gpsLocation.lat, gpsLocation.lng], {
        radius: gpsLocation.accuracy,
        color: '#3b82f6',
        fillColor: '#3b82f6',
        fillOpacity: 0.12,
        weight: 1.5,
        dashArray: '4, 4'
      }).addTo(map);

      // Blue Pulsing Indicator marker
      const gpsIcon = L.divIcon({
        className: 'gps-pulse-marker',
        html: `
          <div class="relative flex items-center justify-center" style="width: 24px; height: 24px;">
            <div class="gps-pulse-ring"></div>
            <div class="gps-pulse-dot"></div>
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      gpsMarkerRef.current = L.marker([gpsLocation.lat, gpsLocation.lng], {
        icon: gpsIcon,
        zIndexOffset: 1000
      }).addTo(map);

      map.setView([gpsLocation.lat, gpsLocation.lng], 16);
    }
  }, [gpsLocation]);

  // Initialize Map & Mini Map & Geoman drawing
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Optimized map options for hardware acceleration and animation
    const map = L.map(mapContainerRef.current, {
      center: [22.3039, 70.8022], // Rajkot, Gujarat
      zoom: 12,
      zoomControl: true,
      attributionControl: false,
      zoomAnimation: true,
      fadeAnimation: true,
      markerZoomAnimation: true,
      inertia: true
    });

    roadmapLayer.current.addTo(map);
    mapRef.current = map;

    // Standard Scale Control placed at bottom-right next to mouse coordinate panel
    L.control.scale({ position: 'bottomright' }).addTo(map);

    // Sync base maps inside native Layer Control
    const baseLayers = {
      "Road Map": roadmapLayer.current,
      "Satellite": satelliteLayer.current,
      "Dark Mode": darkLayer.current,
      "Light Mode": lightLayer.current,
      "Topographic": topoLayer.current,
      "Terrain": terrainLayer.current
    };

    const layerControl = L.control.layers(baseLayers, {}, { position: 'topleft' });
    layerControl.addTo(map);

    // Sync native baselayer changes back to React state
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    map.on('baselayerchange', (e: any) => {
      const name = e.name;
      if (name === "Road Map") setMapType('roadmap');
      else if (name === "Satellite") setMapType('satellite');
      else if (name === "Dark Mode") setMapType('dark');
      else if (name === "Light Mode") setMapType('light');
      else if (name === "Topographic") setMapType('topo');
      else if (name === "Terrain") setMapType('terrain');
    });

    // Initialize synchronized Mini Map Inset
    if (miniMapContainerRef.current) {
      const miniMap = L.map(miniMapContainerRef.current, {
        center: [22.3039, 70.8022],
        zoom: 8,
        zoomControl: false,
        attributionControl: false,
        dragging: false,
        touchZoom: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19
      }).addTo(miniMap);

      const miniMarker = L.circleMarker([22.3039, 70.8022], {
        radius: 4.5,
        color: '#10b981',
        fillColor: '#10b981',
        fillOpacity: 1.0,
        weight: 1
      }).addTo(miniMap);

      map.on('move', () => {
        const center = map.getCenter();
        miniMap.setView(center, Math.max(0, map.getZoom() - 4));
        miniMarker.setLatLng(center);
      });

      miniMapRef.current = miniMap;
    }

    // Initialize Geoman Drawing Toolbar
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pmMap = map as any;
    if (pmMap.pm) {
      pmMap.pm.addControls({
        position: 'topright',
        drawMarker: true,
        drawCircleMarker: false,
        drawPolyline: true,
        drawRectangle: true,
        drawPolygon: true,
        drawCircle: true,
        editMode: true,
        dragMode: true,
        cutPolygon: false,
        removalMode: true
      });

      pmMap.pm.setLang('en');

      // Listen to geometry creation events and display measurements
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      map.on('pm:create', (e: any) => {
        const { layer, shape } = e;
        let tooltipContent = '';

        if (shape === 'Polygon' || shape === 'Rectangle') {
          const latlngs = layer.getLatLngs()[0];
          const area = getPolygonArea(latlngs);
          const areaStr = area > 1000000 
            ? `${(area / 1000000).toFixed(2)} km²` 
            : `${area.toFixed(0)} m²`;
          tooltipContent = `Area: ${areaStr}`;
        } else if (shape === 'Line') {
          const latlngs = layer.getLatLngs();
          const length = getLineLength(latlngs);
          const lenStr = length > 1000 
            ? `${(length / 1000).toFixed(2)} km` 
            : `${length.toFixed(0)} m`;
          tooltipContent = `Length: ${lenStr}`;
        } else if (shape === 'Circle') {
          const radius = layer.getRadius();
          const area = Math.PI * radius * radius;
          const areaStr = area > 1000000 
            ? `${(area / 1000000).toFixed(2)} km²` 
            : `${area.toFixed(0)} m²`;
          tooltipContent = `Radius: ${radius.toFixed(0)} m<br>Area: ${areaStr}`;
        } else if (shape === 'Marker') {
          const customIcon = L.divIcon({
            className: 'custom-selection-icon',
            html: `<div style="background-color: #3b82f6; border: 3px solid #ffffff; border-radius: 50%; width: 20px; height: 20px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); display: flex; align-items: center; justify-content: center;"><div style="width: 4px; height: 4px; border-radius: 50%; background-color: #ffffff;"></div></div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10]
          });
          layer.setIcon(customIcon);
          tooltipContent = `Point location: [${layer.getLatLng().lat.toFixed(5)}, ${layer.getLatLng().lng.toFixed(5)}]`;
        }

        if (tooltipContent) {
          layer.bindTooltip(tooltipContent, {
            permanent: shape !== 'Marker',
            direction: 'center',
            className: 'custom-leaflet-tooltip'
          }).openTooltip();
        }

        layer.on('click', () => {
          if (pmMap.pm.globalRemovalModeEnabled()) {
            layer.remove();
          }
        });
      });
    }

    // Map Click Listener for Selection Pin
    map.on('click', async (e: L.LeafletMouseEvent) => {
      // Prevent selection marker drop if Geoman is actively drawing or editing
      if (pmMap.pm && pmMap.pm.globalDrawModeEnabled()) return;
      const { lat, lng } = e.latlng;
      await handleMapSelectRef.current(lat, lng);
    });

    return () => {
      if (miniMapRef.current) {
        miniMapRef.current.remove();
        miniMapRef.current = null;
      }
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update map type layers on mapType state changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (map.hasLayer(roadmapLayer.current)) map.removeLayer(roadmapLayer.current);
    if (map.hasLayer(satelliteLayer.current)) map.removeLayer(satelliteLayer.current);
    if (map.hasLayer(darkLayer.current)) map.removeLayer(darkLayer.current);
    if (map.hasLayer(lightLayer.current)) map.removeLayer(lightLayer.current);
    if (map.hasLayer(topoLayer.current)) map.removeLayer(topoLayer.current);
    if (map.hasLayer(terrainLayer.current)) map.removeLayer(terrainLayer.current);

    if (mapType === 'roadmap') roadmapLayer.current.addTo(map);
    else if (mapType === 'satellite') satelliteLayer.current.addTo(map);
    else if (mapType === 'dark') darkLayer.current.addTo(map);
    else if (mapType === 'light') lightLayer.current.addTo(map);
    else if (mapType === 'topo') topoLayer.current.addTo(map);
    else if (mapType === 'terrain') terrainLayer.current.addTo(map);
  }, [mapType]);

  const onDragEndRef = useRef<(() => Promise<void>) | undefined>(undefined);
  useEffect(() => {
    onDragEndRef.current = async () => {
      const marker = selectionMarkerRef.current;
      if (marker) {
        const latlng = marker.getLatLng();
        await handleMapSelectRef.current(latlng.lat, latlng.lng);
      }
    };
  });

  // Manage Draggable Selection Pin
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (selectedLocation) {
      const selectionIcon = L.divIcon({
        className: 'custom-selection-icon',
        html: `<div style="background-color: #10b981; border: 3px solid #ffffff; border-radius: 50%; width: 24px; height: 24px; box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.3); display: flex; align-items: center; justify-content: center; cursor: grab;"><div style="width: 6px; height: 6px; border-radius: 50%; background-color: #ffffff;"></div></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      if (selectionMarkerRef.current) {
        selectionMarkerRef.current.setLatLng([selectedLocation.lat, selectedLocation.lng]);
        if (!map.hasLayer(selectionMarkerRef.current)) {
          selectionMarkerRef.current.addTo(map);
        }
      } else {
        const marker = L.marker([selectedLocation.lat, selectedLocation.lng], {
          draggable: true,
          icon: selectionIcon
        }).addTo(map);

        marker.on('dragend', () => {
          onDragEndRef.current?.();
        });

        selectionMarkerRef.current = marker;
      }
      map.panTo([selectedLocation.lat, selectedLocation.lng]);
    } else {
      if (selectionMarkerRef.current) {
        map.removeLayer(selectionMarkerRef.current);
        selectionMarkerRef.current = null;
      }
    }
  }, [selectedLocation]);

  // Manage Complaint Markers, Cluster, popups, tooltips
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (clusterGroupRef.current) {
      map.removeLayer(clusterGroupRef.current);
      clusterGroupRef.current = null;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const clusterGroup = (L as any).markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 50,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      iconCreateFunction: (cluster: any) => {
        const childCount = cluster.getChildCount();
        return L.divIcon({
          html: `<div style="background-color: rgba(99, 102, 241, 0.95); border: 2.5px solid #ffffff; border-radius: 50%; width: 34px; height: 34px; box-shadow: 0 10px 15px -3px rgba(99, 102, 241, 0.4); display: flex; align-items: center; justify-content: center; color: white; font-weight: 900; font-size: 11px;">${childCount}</div>`,
          className: 'custom-cluster-icon',
          iconSize: [34, 34]
        });
      }
    });

    const severityColors = {
      low: '#10b981',
      medium: '#f59e0b',
      high: '#f97316',
      critical: '#ef4444',
    };

    issues.forEach((issue) => {
      if (typeof issue.latitude !== 'number' || typeof issue.longitude !== 'number') return;
      const severityKey = (issue.severity || 'medium').toLowerCase() as keyof typeof severityColors;
      const severityColor = severityColors[severityKey] || '#f59e0b';
      
      let glowClass = `glow-marker-${severityKey}`;
      let borderStyle = '2px solid #ffffff';
      let iconColor = severityColor;
      
      if (showAiOverlay && (issue.aiConfidence !== undefined && issue.aiConfidence < 0.6)) {
        glowClass = 'glow-marker-critical';
        borderStyle = '2.5px solid #a78bfa';
        iconColor = '#8b5cf6'; // Brain-purple highlight
      }

      const customIcon = L.divIcon({
        className: `custom-issue-icon ${glowClass}`,
        html: `<div style="background-color: ${iconColor}; border: ${borderStyle}; border-radius: 50%; width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; cursor: pointer;"><div style="width: 6px; height: 6px; border-radius: 50%; background-color: #ffffff;"></div></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9]
      });

      const marker = L.marker([issue.latitude, issue.longitude], {
        icon: customIcon,
        title: issue.title
      });

      const popupContent = `
        <div style="font-family: sans-serif; color: #f1f5f9; padding: 4px; min-width: 170px;">
          <div style="font-size: 8px; font-weight: 800; text-transform: uppercase; color: ${severityColor}; letter-spacing: 0.05em;">
            ${issue.category} • ${issue.severity}
          </div>
          <div style="font-size: 11px; font-weight: 700; margin-top: 2px; color: #ffffff; line-height: 1.2;">
            ${issue.title}
          </div>
          <div style="font-size: 9px; color: #94a3b8; margin-top: 4px; line-height: 1.3; max-height: 48px; overflow: hidden; text-overflow: ellipsis;">
            ${issue.description}
          </div>
          <div style="font-size: 8px; font-weight: 600; color: #10b981; margin-top: 6px; display: flex; align-items: center; gap: 6px;">
            <span>★ ${issue.upvotesCount} Upvotes</span>
            <span>• Factor: ${issue.priorityScore}/100</span>
          </div>
        </div>
      `;

      marker.bindPopup(popupContent, {
        className: 'custom-leaflet-popup',
        maxWidth: 220
      });

      marker.bindTooltip(issue.title, {
        className: 'custom-leaflet-tooltip',
        direction: 'top',
        offset: [0, -10]
      });

      marker.on('click', () => {
        onMarkerClickRef.current(issue);
        map.panTo([issue.latitude, issue.longitude]);
      });

      clusterGroup.addLayer(marker);
    });

    map.addLayer(clusterGroup);
    clusterGroupRef.current = clusterGroup;

    return () => {
      if (clusterGroupRef.current) {
        map.removeLayer(clusterGroupRef.current);
        clusterGroupRef.current = null;
      }
    };
  }, [issues, showAiOverlay]);

  // Manage Heatmap Overlay
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (heatLayerRef.current) {
      map.removeLayer(heatLayerRef.current);
      heatLayerRef.current = null;
    }

    if (showHeatmap) {
      const heatPoints = issues
        .filter(issue => typeof issue.latitude === 'number' && typeof issue.longitude === 'number')
        .map(issue => {
          const intensity = issue.severity === 'critical' ? 1.0 : issue.severity === 'high' ? 0.8 : issue.severity === 'medium' ? 0.5 : 0.2;
          return [issue.latitude, issue.longitude, intensity];
        });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const heatLayer = (L as any).heatLayer(heatPoints, {
        radius: 25,
        blur: 15,
        maxZoom: 15,
        gradient: {
          0.2: '#10b981',
          0.5: '#f59e0b',
          0.8: '#f97316',
          1.0: '#ef4444'
        }
      });

      heatLayer.addTo(map);
      heatLayerRef.current = heatLayer;
    }

    return () => {
      if (heatLayerRef.current) {
        map.removeLayer(heatLayerRef.current);
        heatLayerRef.current = null;
      }
    };
  }, [issues, showHeatmap]);

  // Handle Search Autocomplete Suggestions
  const handleQueryChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);

    if (query.trim().length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsSearching(true);
    try {
      const response = await axios.get(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&countrycodes=in&addressdetails=1`
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parsedSuggestions = response.data.map((item: any) => ({
        name: item.display_name,
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        state: item.address?.state || '',
        pincode: item.address?.postcode || '',
        rawDetails: item
      }));
      setSuggestions(parsedSuggestions);
      setShowSuggestions(true);
    } catch (err) {
      console.warn('Nominatim suggestion fetch failed, falling back to mock filter:', err);
      const filtered = MOCK_LOCATIONS.filter(loc =>
        loc.name.toLowerCase().includes(query.toLowerCase())
      );
      setSuggestions(filtered);
      setShowSuggestions(true);
    } finally {
      setIsSearching(false);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleSelectSuggestion = (loc: any) => {
    let details: AddressDetails;
    if (loc.rawDetails) {
      details = parseNominatimAddress(loc.rawDetails);
    } else {
      details = {
        rawAddress: loc.name,
        houseNumber: '',
        street: 'Highway Road',
        area: 'Main City Square',
        locality: 'Main Locality',
        landmark: 'City Landmark',
        city: loc.name.split(',')[0],
        district: loc.name.split(',')[0],
        state: loc.state,
        country: 'India',
        pincode: loc.pincode,
      };
    }

    if (mapRef.current) {
      mapRef.current.setView([loc.lat, loc.lng], 16);
    }

    onLocationSelectedRef.current(loc.lat, loc.lng, details);
    setSearchQuery(loc.name);
    setShowSuggestions(false);
  };

  // Locate Current GPS Location
  const handleLocateUser = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const accuracy = position.coords.accuracy || 30;

          setGpsLocation({ lat, lng, accuracy });

          try {
            const response = await axios.get(
              `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`
            );
            const addressDetails = parseNominatimAddress(response.data);
            setSearchQuery(addressDetails.rawAddress);
            onLocationSelectedRef.current(lat, lng, addressDetails);
          } catch (e) {
            console.warn('GPS location reverse geocode failed:', e);
            fallbackGeocode(lat, lng);
          }
        },
        () => {
          alert('Could not access current location. Please grant GPS permissions.');
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }
  };

  // Fullscreen toggle handler
  const handleToggleFullscreen = () => {
    const container = fullscreenContainerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen().catch((err) => {
        console.error('Failed to trigger fullscreen:', err);
      });
    } else {
      document.exitFullscreen();
    }
  };

  return (
    <div 
      ref={fullscreenContainerRef}
      className={`relative w-full h-[520px] rounded-3xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-2xl fullscreen-map-container`}
    >
      <style>{`
        /* Styled base layers control */
        .leaflet-control-layers {
          background-color: rgba(15, 23, 42, 0.95) !important;
          border: 1px solid rgba(51, 65, 85, 0.8) !important;
          border-radius: 16px !important;
          color: #f1f5f9 !important;
          font-family: inherit !important;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5) !important;
          backdrop-filter: blur(8px) !important;
          transition: all 0.2s ease-in-out !important;
          padding: 6px !important;
          margin-top: 70px !important; /* shift down past search suggestions */
        }
        .leaflet-control-layers:hover {
          border-color: rgba(16, 185, 129, 0.6) !important;
        }
        .leaflet-control-layers-toggle {
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%2310b981' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolygon points='12 2 2 7 12 12 22 7 12 2'%3E%3C/polygon%3E%3Cpolyline points='2 17 12 22 22 17'%3E%3C/polyline%3E%3Cpolyline points='2 12 12 17 22 12'%3E%3C/polyline%3E%3C/svg%3E") !important;
          background-size: 20px !important;
          width: 36px !important;
          height: 36px !important;
        }
        .leaflet-control-layers-list {
          font-size: 10px !important;
          font-weight: 700 !important;
          color: #cbd5e1 !important;
          padding: 4px 6px !important;
        }
        .leaflet-control-layers-base label, .leaflet-control-layers-overlays label {
          margin: 6px 0 !important;
          cursor: pointer !important;
          display: flex !important;
          align-items: center !important;
        }
        .leaflet-control-layers-selector {
          accent-color: #10b981 !important;
          margin-right: 8px !important;
          width: 13px !important;
          height: 13px !important;
          cursor: pointer !important;
        }

        /* Glassmorphism Geoman toolbar */
        .leaflet-pm-toolbar {
          background-color: rgba(15, 23, 42, 0.95) !important;
          border: 1px solid rgba(51, 65, 85, 0.8) !important;
          border-radius: 14px !important;
          overflow: hidden !important;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5) !important;
          backdrop-filter: blur(8px) !important;
          padding: 2px !important;
        }
        .leaflet-buttons-control-button {
          background-color: transparent !important;
          color: #cbd5e1 !important;
          border: none !important;
          transition: all 0.2s !important;
          width: 32px !important;
          height: 32px !important;
          margin: 2px 0 !important;
          border-radius: 8px !important;
        }
        .leaflet-buttons-control-button:hover {
          background-color: rgba(16, 185, 129, 0.15) !important;
          color: #10b981 !important;
        }
        .leaflet-buttons-control-button.active {
          background-color: rgba(16, 185, 129, 0.3) !important;
          color: #10b981 !important;
        }
        .leaflet-pm-actions-container {
          background-color: rgba(15, 23, 42, 0.95) !important;
          border: 1px solid rgba(51, 65, 85, 0.8) !important;
          border-radius: 8px !important;
          font-size: 10px !important;
        }
        .leaflet-pm-action {
          color: #cbd5e1 !important;
        }
        .leaflet-pm-action:hover {
          background-color: rgba(239, 68, 68, 0.15) !important;
          color: #ef4444 !important;
        }

        /* Custom leaflet popups */
        .custom-leaflet-popup .leaflet-popup-content-wrapper {
          background: rgba(15, 23, 42, 0.95) !important;
          border: 1px solid rgba(51, 65, 85, 0.8) !important;
          border-radius: 16px !important;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.6) !important;
          backdrop-filter: blur(12px) !important;
          padding: 6px !important;
        }
        .custom-leaflet-popup .leaflet-popup-tip {
          background: rgba(15, 23, 42, 0.95) !important;
          border-left: 1px solid rgba(51, 65, 85, 0.8) !important;
          border-bottom: 1px solid rgba(51, 65, 85, 0.8) !important;
        }
        .custom-leaflet-popup .leaflet-popup-close-button {
          color: #94a3b8 !important;
          font-size: 15px !important;
          top: 8px !important;
          right: 8px !important;
        }
        .custom-leaflet-popup .leaflet-popup-close-button:hover {
          color: #ffffff !important;
        }

        /* Tooltip styles */
        .custom-leaflet-tooltip {
          background-color: rgba(15, 23, 42, 0.95) !important;
          border: 1px solid rgba(51, 65, 85, 0.8) !important;
          color: #f1f5f9 !important;
          border-radius: 8px !important;
          font-size: 9px !important;
          font-weight: 700 !important;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5) !important;
          backdrop-filter: blur(4px) !important;
          padding: 4px 8px !important;
        }

        /* Fullscreen mode overrides */
        .fullscreen-map-container:fullscreen {
          width: 100vw !important;
          height: 100vh !important;
          max-width: 100vw !important;
          max-height: 100vh !important;
          border-radius: 0px !important;
          border: none !important;
          background-color: #020617 !important;
        }
        .fullscreen-map-container:fullscreen > div {
          border-radius: 0px !important;
        }

        /* GPS Animated pulsing dot */
        .gps-pulse-marker {
          position: relative;
        }
        @keyframes gps-ping {
          0% { transform: scale(0.6); opacity: 1; }
          100% { transform: scale(2.4); opacity: 0; }
        }
        .gps-pulse-ring {
          position: absolute;
          width: 24px;
          height: 24px;
          background-color: rgba(59, 130, 246, 0.4);
          border-radius: 50%;
          animation: gps-ping 1.8s cubic-bezier(0.24, 0, 0.38, 1) infinite;
        }
        .gps-pulse-dot {
          position: relative;
          width: 12px;
          height: 12px;
          background-color: #3b82f6;
          border: 2.5px solid #ffffff;
          border-radius: 50%;
          box-shadow: 0 0 10px rgba(59, 130, 246, 0.8);
        }

        /* Glowing severity markers */
        .glow-marker-low {
          animation: marker-pulse-green 2s infinite;
        }
        .glow-marker-medium {
          animation: marker-pulse-yellow 2s infinite;
        }
        .glow-marker-high {
          animation: marker-pulse-orange 2s infinite;
        }
        .glow-marker-critical {
          animation: marker-pulse-red 2s infinite;
        }

        @keyframes marker-pulse-green {
          0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
          70% { box-shadow: 0 0 0 8px rgba(16, 185, 129, 0); }
          100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }
        @keyframes marker-pulse-yellow {
          0% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.7); }
          70% { box-shadow: 0 0 0 8px rgba(245, 158, 11, 0); }
          100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); }
        }
        @keyframes marker-pulse-orange {
          0% { box-shadow: 0 0 0 0 rgba(249, 115, 22, 0.7); }
          70% { box-shadow: 0 0 0 8px rgba(249, 115, 22, 0); }
          100% { box-shadow: 0 0 0 0 rgba(249, 115, 22, 0); }
        }
        @keyframes marker-pulse-red {
          0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
          70% { box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
          100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
      `}</style>
      
      {/* Search Autocomplete Panel */}
      <div className="absolute top-4 left-4 z-[1000] w-80 max-w-[calc(100%-2rem)]">
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={handleQueryChange}
            placeholder="Search address or facility in India..."
            className="w-full bg-slate-950/90 hover:bg-slate-955 border border-slate-800 focus:border-emerald-500 text-slate-100 placeholder-slate-500 rounded-xl py-3 pl-11 pr-4 text-xs font-semibold shadow-2xl backdrop-blur-md focus:outline-none transition-all"
          />
          <Search className="absolute left-4 top-3.5 h-4 w-4 text-slate-400 pointer-events-none z-10" />
          {isSearching && (
            <div className="absolute right-4 top-3.5 h-3.5 w-3.5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          )}
        </div>

        {showSuggestions && suggestions.length > 0 && (
          <ul className="mt-1.5 w-full bg-slate-950/95 border border-slate-800 rounded-xl overflow-hidden shadow-2xl backdrop-blur-md max-h-60 overflow-y-auto">
            {suggestions.map((loc, idx) => (
              <li key={idx}>
                <button
                  type="button"
                  onClick={() => handleSelectSuggestion(loc)}
                  className="w-full text-left px-4 py-2.5 hover:bg-emerald-500/10 hover:text-emerald-400 text-[11px] font-semibold text-slate-300 border-b border-slate-900 last:border-0 transition-colors cursor-pointer"
                >
                  {loc.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Leaflet Map Div Container */}
      <div ref={mapContainerRef} className="w-full h-full z-10" />

      {/* Mini Map Inset */}
      <div 
        ref={miniMapContainerRef} 
        className="absolute bottom-4 left-4 z-[1000] w-28 h-28 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl bg-slate-950/90 pointer-events-none hover:scale-105 transition-transform duration-200"
      />

      {/* Mouse Coordinates Panel */}
      {mouseCoords && (
        <div className="absolute bottom-4 right-28 z-[1000] px-2.5 py-1.5 bg-slate-950/90 border border-slate-800 rounded-xl text-[9px] font-mono font-semibold text-slate-400 backdrop-blur-sm pointer-events-none shadow-xl">
          LAT: {mouseCoords.lat.toFixed(5)} • LNG: {mouseCoords.lng.toFixed(5)}
        </div>
      )}

      {/* Map Control Buttons Panel */}
      <div className="absolute top-4 right-4 flex flex-wrap gap-2 z-[1000] justify-end max-w-[calc(100%-22rem)]">
        {(['roadmap', 'satellite', 'dark', 'light', 'topo', 'terrain'] as const).map((id) => {
          const label = id === 'roadmap' ? 'Road' 
                      : id === 'satellite' ? 'Sat' 
                      : id === 'dark' ? 'Dark' 
                      : id === 'light' ? 'Light' 
                      : id === 'topo' ? 'Topo' 
                      : 'Terrain';
          return (
            <button
              key={id}
              onClick={() => setMapType(id)}
              className={`px-3 py-1.5 rounded-xl border text-[10px] font-extrabold transition-all cursor-pointer ${
                mapType === id 
                  ? 'bg-emerald-500 border-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20' 
                  : 'bg-slate-955/90 border-slate-800 text-slate-400 hover:text-white backdrop-blur-md'
              }`}
            >
              {label}
            </button>
          );
        })}

        <button
          onClick={() => setShowHeatmap((prev) => !prev)}
          className={`p-3 rounded-xl border shadow-lg backdrop-blur-md cursor-pointer transition-colors ${
            showHeatmap 
              ? 'bg-rose-500 border-rose-400 text-white' 
              : 'bg-slate-955/90 border-slate-800 text-rose-400 hover:text-rose-300 hover:bg-slate-900'
          }`}
          title="Toggle Incident Heatmap"
        >
          <Flame className="h-4 w-4" />
        </button>

        <button
          onClick={() => setShowAiOverlay((prev) => !prev)}
          className={`p-3 rounded-xl border shadow-lg backdrop-blur-md cursor-pointer transition-colors ${
            showAiOverlay 
              ? 'bg-violet-600 border-violet-500 text-white' 
              : 'bg-slate-955/90 border-slate-800 text-violet-400 hover:text-violet-300 hover:bg-slate-900'
          }`}
          title="Toggle AI Recommendation Overlay"
        >
          <Cpu className="h-4 w-4" />
        </button>

        <button
          onClick={handleLocateUser}
          className={`p-3 rounded-xl border shadow-lg backdrop-blur-md cursor-pointer transition-colors ${
            gpsLocation 
              ? 'bg-blue-600 border-blue-500 text-white shadow-blue-500/20' 
              : 'bg-slate-955/90 border-slate-800 text-blue-400 hover:text-blue-300 hover:bg-slate-900'
          }`}
          title="Locate Current Position (GPS)"
        >
          <Navigation className="h-4 w-4" />
        </button>

        <button
          onClick={() => {
            if (mapRef.current) {
              mapRef.current.setView([22.3039, 70.8022], 12);
            }
          }}
          className="p-3 rounded-xl bg-slate-955/90 border border-slate-800 text-teal-400 hover:text-teal-300 hover:bg-slate-900 shadow-lg backdrop-blur-md cursor-pointer transition-colors"
          title="Reset Map Orientation (Compass)"
        >
          <Compass className="h-4 w-4" />
        </button>

        <button
          onClick={handleToggleFullscreen}
          className={`p-3 rounded-xl border shadow-lg backdrop-blur-md cursor-pointer transition-colors ${
            isFullscreen
              ? 'bg-amber-600 border-amber-500 text-white'
              : 'bg-slate-955/90 border-slate-800 text-amber-400 hover:text-amber-300 hover:bg-slate-900'
          }`}
          title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
};
