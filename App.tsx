import React, { useState, useEffect, useRef } from 'react';
import { ViewState, AnalysisResult, AnalysisType, Badge, Deal, LicensePlateReport } from './types';
import { BEHAVIORS, INITIAL_BADGES, INITIAL_DEALS, ENABLE_DEBUG_TOOLS } from './constants';
import { analyzeImage } from './services/geminiService';
import { trackView, trackEvent } from './services/posthog';
import BottomNav from './components/BottomNav';
import Button from './components/Button';
import HeatMap from './components/HeatMap';
import { Camera, X, Check, Award, AlertTriangle, AlertCircle, MapPin, ChevronRight, Upload, Ticket, Keyboard, Settings as SettingsIcon, Activity, Zap, Brain, Calendar, ImageOff, MessageSquare, Mail, Image as ImageIcon } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import L from 'leaflet';

// --- Helper: Leaflet Picker Component ---

interface LeafletPickerProps {
    onLocationSelect: (lat: number, lng: number) => void;
    initialLat?: number;
    initialLng?: number;
}

const LeafletPicker: React.FC<LeafletPickerProps> = ({ onLocationSelect, initialLat, initialLng }) => {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<L.Map | null>(null);
    const markerRef = useRef<L.Marker | null>(null);
    
    // Miami Center default
    const DEFAULT_LAT = 25.774;
    const DEFAULT_LNG = -80.133;

    useEffect(() => {
        if (!mapContainerRef.current) return;

        if (!mapRef.current) {
            mapRef.current = L.map(mapContainerRef.current, {
                center: [initialLat || DEFAULT_LAT, initialLng || DEFAULT_LNG],
                zoom: 15,
                zoomControl: true,
                attributionControl: false
            });

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
            }).addTo(mapRef.current);

            // Custom Icon
            const icon = L.divIcon({
                className: 'bg-transparent',
                html: `<div class="w-8 h-8 bg-red-600 rounded-full border-4 border-white shadow-lg transform -translate-x-1/2 -translate-y-1/2"></div>`,
                iconSize: [0, 0]
            });

            // Click handler
            mapRef.current.on('click', (e) => {
                const { lat, lng } = e.latlng;
                
                if (markerRef.current) {
                    markerRef.current.setLatLng([lat, lng]);
                } else {
                    markerRef.current = L.marker([lat, lng], { icon }).addTo(mapRef.current!);
                }
                
                onLocationSelect(lat, lng);
            });
        }

        // If initial coords provided, set marker
        if (initialLat && initialLng && mapRef.current) {
             const icon = L.divIcon({
                className: 'bg-transparent',
                html: `<div class="w-8 h-8 bg-red-600 rounded-full border-4 border-white shadow-lg transform -translate-x-1/2 -translate-y-1/2"></div>`,
                iconSize: [0, 0]
            });
            if (!markerRef.current) {
                markerRef.current = L.marker([initialLat, initialLng], { icon }).addTo(mapRef.current);
            } else {
                markerRef.current.setLatLng([initialLat, initialLng]);
            }
            mapRef.current.setView([initialLat, initialLng], 15);
        }

        // Fix tiles on resize - try multiple times with increasing delays
        [100, 300, 500].forEach((delay) => {
            setTimeout(() => {
                mapRef.current?.invalidateSize();
            }, delay);
        });

    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
                markerRef.current = null;
            }
        };
    }, []);

    return <div ref={mapContainerRef} className="w-full h-full bg-zinc-100" />;
};


// --- View Components ---

const Header: React.FC = () => (
  <header 
    className="pb-4 px-6 bg-white sticky top-0 z-40 border-b border-zinc-100"
    style={{ paddingTop: 'calc(2rem + env(safe-area-inset-top, 0px))' }}
  >
    <div className="flex justify-between items-center">
      <div>
        <h1 className="text-2xl font-display font-black text-red-600 italic tracking-tighter transform -skew-x-12">
          PETTY PATROL
        </h1>
        <p className="text-xs font-bold text-zinc-400 tracking-wider">STAY SAFE. STAY PETTY.</p>
      </div>
    </div>
  </header>
);

const Onboarding: React.FC<{ onComplete: () => void }> = ({ onComplete }) => (
  <div 
    className="min-h-screen bg-red-600 text-white p-8 flex flex-col justify-center items-center text-center"
    style={{ 
      paddingTop: 'calc(2rem + env(safe-area-inset-top, 0px))',
      paddingBottom: 'calc(2rem + env(safe-area-inset-bottom, 0px))',
      minHeight: '100dvh'
    }}
  >
    <div className="mb-8 p-6 bg-white rounded-full shadow-xl">
      <Award size={64} className="text-red-600" />
    </div>
    <h1 className="text-4xl font-display font-black mb-4 italic">WELCOME TO THE CHAOS</h1>
    <p className="text-lg font-medium opacity-90 mb-8 max-w-xs">
      Catch bad drivers. Claim sweet deals. Don't be an asshole while doing it.
    </p>
    <div className="space-y-4 w-full max-w-xs text-left bg-red-700/30 p-6 rounded-2xl mb-8 border border-red-400/30">
      <div className="flex gap-3">
         <Camera className="shrink-0" />
         <p className="text-sm">Passenger? Snap a pic of a plate.</p>
      </div>
      <div className="flex gap-3">
         <Ticket className="shrink-0" />
         <p className="text-sm">Scan Partner QR codes for free stuff.</p>
      </div>
    </div>
    <Button onClick={onComplete} variant="secondary" size="lg" fullWidth>
      Let's Roll
    </Button>
  </div>
);

// --- Main App Component ---

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>(ViewState.ONBOARDING);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [selectedBehaviors, setSelectedBehaviors] = useState<string[]>([]);
  const [customNote, setCustomNote] = useState('');
  const [manualPlateText, setManualPlateText] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<{lat: number, lng: number, address: string} | null>(null);
  
  // App Data
  const [badges, setBadges] = useState<Badge[]>(INITIAL_BADGES);
  const [deals, setDeals] = useState<Deal[]>(INITIAL_DEALS);
  const [reports, setReports] = useState<LicensePlateReport[]>([]);
  const [editingReport, setEditingReport] = useState<LicensePlateReport | null>(null);
  const [editPlateText, setEditPlateText] = useState('');
  const [editBehaviors, setEditBehaviors] = useState<string[]>([]);
  const [editCustomNote, setEditCustomNote] = useState('');
  const [editLocation, setEditLocation] = useState<{lat: number, lng: number, address: string} | null>(null);
  
  // Location picker state
  const [locationPickerReturnView, setLocationPickerReturnView] = useState<ViewState>(ViewState.MANUAL_ENTRY);
  const [tempLocation, setTempLocation] = useState<{lat: number, lng: number} | null>(null);
  
  // Previous reports state
  const [previousReportsForPlate, setPreviousReportsForPlate] = useState<LicensePlateReport[]>([]);
  const [currentPlateText, setCurrentPlateText] = useState<string>('');
  
  // Feedback form state
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackImage, setFeedbackImage] = useState<string | null>(null);
  
  // 500 points notice state
  const [show500PointsNotice, setShow500PointsNotice] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const feedbackFileInputRef = useRef<HTMLInputElement>(null);

  // Update edit state when editingReport changes
  useEffect(() => {
    if (editingReport) {
      setEditPlateText(editingReport.plateText);
      setEditBehaviors(editingReport.behaviors);
      setEditCustomNote(editingReport.customNote || '');
      setEditLocation(editingReport.coordinates ? { 
        lat: editingReport.coordinates.lat, 
        lng: editingReport.coordinates.lng, 
        address: editingReport.location || '' 
      } : null);
    } else {
      setEditPlateText('');
      setEditBehaviors([]);
      setEditCustomNote('');
      setEditLocation(null);
    }
  }, [editingReport]);

  // Show 500 points notice when points first reach 500
  useEffect(() => {
    const totalPoints = reports.length * 50;
    if (totalPoints >= 500 && view === ViewState.DEALS && !show500PointsNotice) {
      trackEvent('milestone_reached', { 
        milestone: '500_points',
        totalPoints,
        reportsCount: reports.length,
      });
      setShow500PointsNotice(true);
    }
  }, [reports.length, view, show500PointsNotice]);

  // Track view changes for analytics
  useEffect(() => {
    trackView(view, {
      reportsCount: reports.length,
      badgesUnlocked: badges.filter(b => b.unlocked).length,
      totalPoints: reports.length * 50,
    });
  }, [view]);

  const handleCaptureClick = () => {
    trackEvent('capture_initiated', { method: 'camera' });
    fileInputRef.current?.click();
  };

  const handleGalleryClick = () => {
    trackEvent('capture_initiated', { method: 'gallery' });
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/bbeae9bf-8eb7-41dc-9639-4ea255cdd7a2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:handleGalleryClick',message:'Gallery click handler called',data:{hasRef:!!galleryInputRef.current,isConnected:galleryInputRef.current?.isConnected,disabled:galleryInputRef.current?.disabled,type:galleryInputRef.current?.type},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H1,H2,H3'})}).catch(()=>{});
    // #endregion
    console.log('handleGalleryClick called, ref exists:', !!galleryInputRef.current);
    if (galleryInputRef.current) {
      console.log('Input element:', {
        isConnected: galleryInputRef.current.isConnected,
        disabled: galleryInputRef.current.disabled,
        type: galleryInputRef.current.type,
        accept: galleryInputRef.current.accept,
        parentElement: !!galleryInputRef.current.parentElement
      });
      try {
        galleryInputRef.current.click();
        console.log('click() method called successfully');
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/bbeae9bf-8eb7-41dc-9639-4ea255cdd7a2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:handleGalleryClick:clickCalled',message:'Input click() method executed',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H3'})}).catch(()=>{});
        // #endregion
      } catch (err: any) {
        console.error('Error calling click():', err);
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/bbeae9bf-8eb7-41dc-9639-4ea255cdd7a2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:handleGalleryClick:clickError',message:'Error calling click()',data:{error:err?.message || 'unknown'},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H3'})}).catch(()=>{});
        // #endregion
      }
    } else {
      console.error('galleryInputRef.current is null!');
    }
  };

  // Geolocation helper for auto-capturing location
  const captureCurrentLocation = (): Promise<{lat: number, lng: number} | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({ 
            lat: position.coords.latitude, 
            lng: position.coords.longitude 
          });
        },
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    });
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>, isFromCamera: boolean = true) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setView(ViewState.ANALYZING);
    setAnalyzing(true);
    
    // Reset location for new capture
    setSelectedLocation(null);
    
    // If from camera, try to auto-capture geolocation
    let autoLocation: {lat: number, lng: number} | null = null;
    if (isFromCamera) {
      autoLocation = await captureCurrentLocation();
      if (autoLocation) {
        const address = getAddressFromCoords(autoLocation.lat, autoLocation.lng);
        setSelectedLocation({ ...autoLocation, address });
      }
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      setCurrentImage(base64String);
      
      // Send to Gemini
      const base64Content = base64String.split(',')[1];
      const result = await analyzeImage(base64Content, file.type);
      
      setAnalysisResult(result);
      setAnalyzing(false);

      // Track analysis completion
      trackEvent('image_analysis_completed', {
        type: result.type,
        confidence: result.confidence,
        success: result.type !== AnalysisType.INVALID,
        fromCamera: isFromCamera,
      });

      if (result.type === AnalysisType.LICENSE_PLATE) {
        setView(ViewState.BEHAVIOR_PICKER);
      } else if (result.type === AnalysisType.QR_CODE) {
        handleQrClaim(result.value);
      } else {
        // Stay on analyzing screen but show error with PRD text
        setTimeout(() => {
            alert("Hmm. That's not a plate or a partner QR.");
            setView(ViewState.HOME);
        }, 500);
      }
    };
    reader.readAsDataURL(file);
    
    // Reset file input so same file can be selected again
    event.target.value = '';
  };

  const handleQrClaim = (qrValue: string) => {
    const matchedDeal = deals.find(d => d.qrCodeId === qrValue || qrValue.includes(d.qrCodeId));
    
    if (matchedDeal) {
      if(matchedDeal.claimed) {
          trackEvent('deal_claim_attempted', { 
            dealId: matchedDeal.id, 
            partnerName: matchedDeal.partnerName,
            alreadyClaimed: true 
          });
          alert("You already claimed this deal!");
          setView(ViewState.DEALS);
          return;
      }
      const updatedDeals = deals.map(d => d.id === matchedDeal.id ? { ...d, claimed: true } : d);
      setDeals(updatedDeals);
      setAnalysisResult({ type: AnalysisType.QR_CODE, value: matchedDeal.partnerName, confidence: 1 });
      
      // Track successful deal claim
      trackEvent('deal_claimed', { 
        dealId: matchedDeal.id, 
        partnerName: matchedDeal.partnerName,
        offer: matchedDeal.offer
      });
      
      setView(ViewState.CELEBRATION);
    } else {
       trackEvent('qr_code_invalid', { qrValue });
       alert("Oops! That QR code isn't from one of our partners.");
       setView(ViewState.HOME);
    }
  };

  const getAddressFromCoords = (lat: number, lng: number) => {
    // A simplified reverse geocoder for Miami grid
    // Miami Avenues run N/S, Streets run E/W
    // This is purely for flavor in the prototype
    
    const latBase = 25.774;
    const lngBase = -80.133;
    
    const latDiff = (lat - latBase) * 1000; // Roughly blocks
    const lngDiff = (lng - lngBase) * 1000;

    const streetNum = Math.abs(Math.floor(10 + latDiff));
    const isSt = Math.random() > 0.3; // mostly streets
    
    const avenues = ['Ocean Dr', 'Collins Ave', 'Washington Ave', 'Alton Rd', 'Meridian Ave', 'Jefferson Ave'];
    const aveIndex = Math.abs(Math.floor(lngDiff)) % avenues.length;
    
    return `${streetNum}${streetNum % 10 === 1 ? 'st' : streetNum % 10 === 2 ? 'nd' : 'th'} St & ${avenues[aveIndex]}`;
  };

  const handleLocationSelect = (lat: number, lng: number) => {
      const address = getAddressFromCoords(lat, lng);
      setSelectedLocation({ lat, lng, address });
  };

  const submitReport = () => {
    const isOtherSelected = selectedBehaviors.includes('other_custom');
    const isOtherOnly = selectedBehaviors.length === 1 && isOtherSelected;
    
    if (selectedBehaviors.length === 0) return;
    if (isOtherOnly && !customNote.trim()) {
        alert("Please describe what they did.");
        return;
    }
    if (!selectedLocation) {
        alert("Please tap the map to pin a location.");
        return;
    }

    const plateText = analysisResult?.value || 'UNKNOWN';
    
    const newReport: LicensePlateReport = {
      id: Date.now().toString(),
      plateText: plateText,
      behaviors: selectedBehaviors,
      customNote: isOtherSelected ? customNote : undefined,
      timestamp: Date.now(),
      location: selectedLocation.address,
      coordinates: { lat: selectedLocation.lat, lng: selectedLocation.lng }
    };

    // Check for previous reports of this plate BEFORE adding new one
    const existingReports = reports.filter(r => r.plateText.toUpperCase() === plateText.toUpperCase());
    
    setReports([newReport, ...reports]);
    
    // Track report submission
    trackEvent('report_submitted', {
      behaviorsCount: selectedBehaviors.length,
      behaviors: selectedBehaviors,
      hasCustomNote: !!customNote,
      hasPhoto: !!currentImage,
      isRepeatOffender: existingReports.length > 0,
      previousReportsCount: existingReports.length,
    });
    
    // Check for badges
    let newBadgesUnlocked = false;
    const unlockedBadgeIds: string[] = [];
    const updatedBadges = badges.map(badge => {
      if (badge.unlocked) return badge;
      
      if (badge.id === 'first_catch') {
        newBadgesUnlocked = true;
        unlockedBadgeIds.push(badge.id);
        return { ...badge, unlocked: true };
      }

      if (badge.requiredBehaviorId && selectedBehaviors.includes(badge.requiredBehaviorId)) {
        newBadgesUnlocked = true;
        unlockedBadgeIds.push(badge.id);
        return { ...badge, unlocked: true };
      }

      if (badge.id === 'legendary' && selectedBehaviors.length >= 4) {
         newBadgesUnlocked = true;
         unlockedBadgeIds.push(badge.id);
         return { ...badge, unlocked: true };
      }

      return badge;
    });

    if (newBadgesUnlocked) {
      setBadges(updatedBadges);
      // Track each badge unlock
      unlockedBadgeIds.forEach(badgeId => {
        const badge = badges.find(b => b.id === badgeId);
        if (badge) {
          trackEvent('badge_unlocked', { 
            badgeId: badge.id, 
            badgeName: badge.name 
          });
        }
      });
    }
    
    // If this plate has been reported before, show Previous Reports screen
    if (existingReports.length > 0) {
      // Track repeat offender detection
      trackEvent('repeat_offender_detected', {
        plateText,
        previousReportsCount: existingReports.length,
      });
      
      setPreviousReportsForPlate(existingReports);
      setCurrentPlateText(plateText);
      setView(ViewState.PREVIOUS_REPORTS);
    } else {
      setView(ViewState.CELEBRATION);
    }
    
    setSelectedBehaviors([]);
    setCustomNote('');
    setSelectedLocation(null);
  };

  const renderLocationSection = (label: string = "Where did it happen?") => (
    <div className="bg-white p-6 rounded-2xl shadow-lg border border-zinc-100 mb-4">
        <div className="flex justify-between items-center mb-4">
        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">{label} <span className="text-red-600">*</span></label>
        {selectedLocation && (
            <span className="text-xs font-bold text-red-600 flex items-center gap-1">
                <MapPin size={12} /> {selectedLocation.address}
            </span>
        )}
        </div>
        
        <div className="w-full h-48 rounded-xl relative overflow-hidden border border-zinc-200">
            <LeafletPicker 
                onLocationSelect={handleLocationSelect} 
                initialLat={selectedLocation?.lat}
                initialLng={selectedLocation?.lng}
            />
            
            {!selectedLocation && (
                <div className="absolute top-2 left-2 z-[400] bg-white/90 px-3 py-1.5 rounded-lg text-xs font-bold text-zinc-500 shadow-sm pointer-events-none">
                    Tap map to pin location
                </div>
            )}
        </div>
    </div>
  );

  const renderContent = () => {
    switch (view) {
      case ViewState.ONBOARDING:
        return <Onboarding onComplete={() => {
          trackEvent('onboarding_completed');
          setView(ViewState.HOME);
        }} />;
      
      case ViewState.HOME:
        return (
          <div className="min-h-screen bg-zinc-50 pb-24">
            <Header />
            <div className="flex flex-col items-center justify-center h-[70vh] px-6">
              {/* Camera input - opens camera on mobile */}
              <input 
                type="file" 
                ref={fileInputRef}
                className="hidden" 
                accept="image/*" 
                capture="environment"
                onChange={(e) => handleFileChange(e, true)}
              />
              {/* Gallery input - opens photo library on mobile */}
              <input 
                type="file" 
                id="gallery-input"
                ref={galleryInputRef}
                className="absolute w-0 h-0 opacity-0" 
                tabIndex={-1}
                accept="image/*"
                onChange={(e) => {
                  // #region agent log
                  fetch('http://127.0.0.1:7242/ingest/bbeae9bf-8eb7-41dc-9639-4ea255cdd7a2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:galleryInput:onChange',message:'Gallery input onChange fired',data:{hasFiles:!!e.target.files?.length},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H4'})}).catch(()=>{});
                  // #endregion
                  console.log('Gallery input onChange, files:', e.target.files?.length);
                  handleFileChange(e, false);
                }}
              />
              
              <div className="relative group cursor-pointer" onClick={handleCaptureClick}>
                {/* Pulse Effect */}
                <div className="absolute inset-0 bg-red-400 rounded-full opacity-20 group-hover:opacity-30 animate-ping"></div>
                <div className="absolute inset-4 bg-yellow-400 rounded-full opacity-100 group-hover:scale-105 transition-transform duration-300"></div>
                
                <button className="relative w-64 h-64 bg-red-600 rounded-full shadow-xl flex flex-col items-center justify-center border-[8px] border-white z-10 active:scale-95 transition-transform">
                  <Camera size={48} className="text-white mb-2" />
                  <span className="text-3xl font-display font-black text-white italic tracking-tight">CATCH<br/>ONE</span>
                  <div className="mt-2 bg-yellow-400 text-red-900 text-xs font-bold px-3 py-1 rounded-full uppercase">
                    +50 Points
                  </div>
                </button>
              </div>

              <div className="mt-16 flex flex-col items-center gap-8 w-full relative z-30">
                <label 
                  htmlFor="gallery-input"
                  className="text-sm font-bold text-zinc-500 underline decoration-2 decoration-zinc-300 underline-offset-4 active:text-red-600 hover:text-red-600 transition-colors py-2 px-4 relative z-20 cursor-pointer"
                >
                  Upload Photo Instead
                </label>
                <button onClick={() => { 
                    trackEvent('capture_initiated', { method: 'manual' });
                    setManualPlateText(''); 
                    setSelectedLocation(null);
                    setCurrentImage(null);
                    setView(ViewState.MANUAL_ENTRY);
                  }} className="text-sm font-bold text-zinc-500 underline decoration-2 decoration-zinc-300 underline-offset-4 active:text-red-600 hover:text-red-600 transition-colors py-2 px-4 relative z-20">
                  Enter License Plate #
                </button>
              </div>
            </div>
          </div>
        );

      case ViewState.MANUAL_ENTRY:
        return (
            <div className="min-h-screen bg-white pb-24">
                {/* Custom Red Header */}
                <div 
                  className="bg-red-600 pb-4 px-6 flex justify-between items-center shadow-md sticky top-0 z-50"
                  style={{ paddingTop: 'calc(3rem + env(safe-area-inset-top, 0px))' }}
                >
                   <h2 className="text-xl font-display font-bold text-white">Enter License Plate</h2>
                   <button onClick={() => setView(ViewState.HOME)} className="text-white/90 hover:text-white hover:bg-red-700/50 rounded-full p-2 transition-colors">
                     <X size={24} />
                   </button>
                </div>

                <div className="p-6">
                    {/* Input Section */}
                    <div className="mb-6">
                        <label className="block text-sm font-bold text-zinc-900 mb-2">
                           License Plate Number <span className="text-red-600">*</span>
                        </label>
                        <input 
                            type="text" 
                            value={manualPlateText}
                            onChange={(e) => {
                                const sanitized = e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
                                setManualPlateText(sanitized);
                            }}
                            className="w-full text-3xl font-display font-black text-center border-2 border-zinc-200 rounded-xl focus:border-red-600 focus:ring-4 focus:ring-red-50 outline-none py-4 text-zinc-900 placeholder:text-zinc-300 transition-all"
                            placeholder="ABC123"
                            autoFocus
                        />
                    </div>

                    {/* Location Section - Tap to open picker */}
                    <div className="mb-6">
                        <label className="block text-sm font-bold text-zinc-900 mb-2">
                           Where did this happen? <span className="text-red-600">*</span>
                        </label>
                        <button 
                            onClick={() => {
                                setLocationPickerReturnView(ViewState.MANUAL_ENTRY);
                                setTempLocation(selectedLocation ? { lat: selectedLocation.lat, lng: selectedLocation.lng } : null);
                                setView(ViewState.LOCATION_PICKER);
                            }}
                            className="w-full p-4 border-2 border-zinc-200 rounded-xl flex items-center gap-3 hover:border-zinc-300 transition-colors text-left"
                        >
                            <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center">
                                <MapPin size={20} className="text-zinc-500" />
                            </div>
                            <span className={`flex-1 ${selectedLocation ? 'text-zinc-900 font-medium' : 'text-zinc-400'}`}>
                                {selectedLocation ? selectedLocation.address : 'Tap to select location'}
                            </span>
                            <ChevronRight size={20} className="text-zinc-400" />
                        </button>
                    </div>

                    {/* Congratulatory Memory Message */}
                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-8 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center shrink-0">
                            <Brain size={20} className="text-yellow-600" />
                        </div>
                        <p className="text-sm text-yellow-800 font-medium">
                           Nice job! You remembered the plate.
                        </p>
                    </div>

                    <Button 
                        fullWidth 
                        size="lg" 
                        onClick={() => {
                            if (manualPlateText.trim().length < 2) {
                                alert("Please enter a valid plate number (letters and numbers only).");
                                return;
                            }
                            if (!selectedLocation) {
                                alert("Please select a location first.");
                                return;
                            }
                            setAnalysisResult({
                                type: AnalysisType.LICENSE_PLATE,
                                value: manualPlateText.toUpperCase(),
                                confidence: 1.0
                            });
                            setView(ViewState.BEHAVIOR_PICKER);
                        }}
                        disabled={!manualPlateText.trim() || !selectedLocation}
                    >
                        Continue
                    </Button>
                </div>
            </div>
        );

      case ViewState.LOCATION_PICKER:
        return (
            <div className="h-screen bg-white flex flex-col overflow-hidden">
                {/* Red Header */}
                <div 
                  className="bg-red-600 pb-4 px-6 flex justify-between items-center shadow-md shrink-0 z-50"
                  style={{ paddingTop: 'calc(3rem + env(safe-area-inset-top, 0px))' }}
                >
                   <h2 className="text-xl font-display font-bold text-white">Select Location</h2>
                   <button 
                     onClick={() => {
                       setTempLocation(null);
                       setView(locationPickerReturnView);
                     }} 
                     className="text-white/90 hover:text-white hover:bg-red-700/50 rounded-full p-2 transition-colors"
                   >
                     <X size={24} />
                   </button>
                </div>

                {/* Full-height Map - explicit height calculation */}
                <div className="flex-1 relative min-h-0">
                    <div className="absolute inset-0">
                        <LeafletPicker 
                            onLocationSelect={(lat, lng) => {
                                setTempLocation({ lat, lng });
                            }} 
                            initialLat={tempLocation?.lat || selectedLocation?.lat}
                            initialLng={tempLocation?.lng || selectedLocation?.lng}
                        />
                    </div>
                </div>

                {/* Bottom Section */}
                <div 
                  className="p-6 bg-white border-t border-zinc-200 shrink-0"
                  style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}
                >
                    <p className="text-sm text-zinc-500 text-center mb-4">
                        Tap anywhere on the map to pin the location
                    </p>
                    <Button 
                        fullWidth 
                        size="lg"
                        onClick={() => {
                            if (tempLocation) {
                                const address = getAddressFromCoords(tempLocation.lat, tempLocation.lng);
                                setSelectedLocation({ ...tempLocation, address });
                            }
                            setView(locationPickerReturnView);
                        }}
                        disabled={!tempLocation && !selectedLocation}
                    >
                        Confirm Location
                    </Button>
                </div>
            </div>
        );

      case ViewState.ANALYZING:
        return (
          <div 
            className="min-h-screen bg-white flex flex-col items-center justify-center p-8"
            style={{ minHeight: '100dvh' }}
          >
            <div className="relative w-24 h-24 mb-8">
               <div className="absolute inset-0 border-4 border-zinc-100 rounded-full"></div>
               <div className="absolute inset-0 border-4 border-red-600 rounded-full border-t-transparent animate-spin"></div>
            </div>
            <h2 className="text-xl font-bold text-zinc-800 animate-pulse">Analyzing Evidence...</h2>
            {currentImage && (
              <img src={currentImage} alt="Analysis" className="w-32 h-32 object-cover rounded-xl mt-8 opacity-50 grayscale" />
            )}
          </div>
        );

      case ViewState.BEHAVIOR_PICKER:
        // Validation logic for button state
        const isOtherSelected = selectedBehaviors.includes('other_custom');
        const isOtherOnly = selectedBehaviors.length === 1 && isOtherSelected;
        const isOtherValid = !isOtherOnly || (isOtherOnly && customNote.trim().length > 0);
        const isLocationValid = !!selectedLocation;
        const isFormValid = selectedBehaviors.length > 0 && isOtherValid && isLocationValid;

        return (
          <div className="min-h-screen bg-zinc-50 pb-32">
             {/* Red Header for Select Behaviors */}
             <div 
               className="bg-red-600 pb-4 px-6 flex justify-between items-center shadow-md sticky top-0 z-50"
               style={{ paddingTop: 'calc(3rem + env(safe-area-inset-top, 0px))' }}
             >
                <h2 className="text-xl font-display font-bold text-white">Select Behaviors</h2>
                <button onClick={() => { setView(ViewState.HOME); setSelectedBehaviors([]); setCustomNote(''); setSelectedLocation(null); }} className="text-white/90 hover:text-white hover:bg-red-700/50 rounded-full p-2 transition-colors">
                  <X size={24} />
                </button>
             </div>

             {/* Image/Placeholder Section */}
             <div className="bg-white p-6 border-b border-zinc-100">
                <div className="flex flex-col items-center">
                  {currentImage ? (
                    <img src={currentImage} className="w-full max-w-xs aspect-[4/3] rounded-2xl object-cover bg-zinc-100 shadow-lg" />
                  ) : (
                    <div className="w-full max-w-xs aspect-[4/3] rounded-2xl bg-zinc-100 flex items-center justify-center border-4 border-dashed border-zinc-300">
                        <div className="text-center">
                          <ImageOff size={48} className="text-zinc-300 mx-auto mb-2" />
                          <p className="text-xs font-bold text-zinc-400 uppercase">No Photo</p>
                        </div>
                    </div>
                  )}
                  <h2 className="text-3xl font-display font-black text-zinc-900 tracking-wider mt-4 text-center">
                    {analysisResult?.value || "UNKNOWN"}
                  </h2>
                </div>
             </div>

             <div className="p-6">
                {renderLocationSection(selectedLocation ? "Confirm Location" : "Where did it happen?")}

                <h3 className="text-sm font-bold text-zinc-900 mb-4 mt-6">What did they do?</h3>
                <div className="space-y-3">
                  {BEHAVIORS.map(b => {
                    const isSelected = selectedBehaviors.includes(b.id);
                    const isOther = b.id === 'other_custom';
                    return (
                      <div key={b.id} className="w-full">
                        <button
                          onClick={() => {
                            setSelectedBehaviors(prev => 
                              prev.includes(b.id) ? prev.filter(id => id !== b.id) : [...prev, b.id]
                            );
                          }}
                          className={`w-full text-left p-4 rounded-xl border-2 transition-all flex items-start gap-4 ${
                            isSelected 
                              ? 'border-red-600 bg-red-50' 
                              : 'border-white bg-white shadow-sm hover:border-zinc-200'
                          }`}
                        >
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl shrink-0 ${isSelected ? 'bg-red-200' : 'bg-zinc-100'}`}>
                            {b.icon}
                          </div>
                          <div className="flex-1">
                            <h4 className={`font-bold ${isSelected ? 'text-red-900' : 'text-zinc-800'}`}>{b.name}</h4>
                            <p className="text-xs text-zinc-500">{b.description}</p>
                          </div>
                          {isSelected && <Check className="text-red-600 mt-1" size={20} />}
                        </button>
                        {isOther && isSelected && (
                          <div className="mt-2 ml-2 pl-4 border-l-2 border-red-200 animate-in slide-in-from-top-2 duration-200">
                             <input
                               type="text"
                               placeholder="What exactly did they do?"
                               value={customNote}
                               onChange={(e) => setCustomNote(e.target.value)}
                               className="w-full p-3 bg-white border border-zinc-200 rounded-lg text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-red-500"
                               autoFocus
                             />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
             </div>

             <div 
               className="fixed bottom-0 left-0 right-0 p-6 bg-white/90 backdrop-blur border-t border-zinc-200 z-20"
               style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}
             >
                <div className="max-w-md mx-auto">
                  <Button fullWidth size="lg" onClick={submitReport} disabled={!isFormValid}>Submit</Button>
                </div>
             </div>
          </div>
        );

      case ViewState.CELEBRATION:
        const isQr = analysisResult?.type === AnalysisType.QR_CODE;
        return (
          <div 
            className="min-h-screen bg-yellow-400 flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in duration-300"
            style={{ 
              paddingTop: 'calc(2rem + env(safe-area-inset-top, 0px))',
              paddingBottom: 'calc(2rem + env(safe-area-inset-bottom, 0px))',
              minHeight: '100dvh'
            }}
          >
            <div className="bg-white p-8 rounded-3xl shadow-xl max-w-sm w-full">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 text-green-600 animate-bounce">
                {isQr ? <Ticket size={40} /> : <Check size={40} />}
              </div>
              
              <h2 className="text-3xl font-display font-black text-zinc-900 italic mb-2">
                {isQr ? "NICE! ENJOY." : "PETTY JUSTICE SERVED 😌"}
              </h2>
              
              <p className="text-zinc-500 font-medium mb-8">
                {isQr 
                  ? `You've successfully claimed the deal at ${analysisResult?.value}.` 
                  : "Oh. It's this car again. Justice, but make it petty."}
              </p>

              {!isQr && selectedBehaviors.length > 3 && (
                 <div className="mb-8 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
                    <p className="text-xs font-bold text-yellow-700 uppercase mb-1">RARE EVENT</p>
                    <p className="font-bold text-yellow-900">LEGENDARY MIAMI DRIVER UNLOCKED 🏆</p>
                 </div>
              )}

              <Button fullWidth onClick={() => setView(ViewState.DEALS)}>
                {isQr ? "View My Deals" : "See Rewards"}
              </Button>
            </div>
          </div>
        );

      case ViewState.PREVIOUS_REPORTS:
        return (
          <div className="min-h-screen bg-white flex flex-col">
            {/* Yellow/Gold Header */}
            <div 
              className="bg-yellow-500 pb-4 px-6 flex justify-between items-start shadow-md sticky top-0 z-50"
              style={{ paddingTop: 'calc(3rem + env(safe-area-inset-top, 0px))' }}
            >
               <div>
                 <h2 className="text-xl font-display font-bold text-zinc-900">Previous Reports</h2>
                 <p className="text-sm font-bold text-zinc-800/70">{currentPlateText}</p>
               </div>
               <button 
                 onClick={() => setView(ViewState.CELEBRATION)} 
                 className="text-zinc-900/70 hover:text-zinc-900 hover:bg-yellow-600/30 rounded-full p-2 transition-colors"
               >
                 <X size={24} />
               </button>
            </div>

            {/* Warning Banner */}
            <div className="bg-yellow-100 border-b border-yellow-200 px-6 py-3 flex items-center gap-3">
                <AlertCircle size={20} className="text-yellow-700 shrink-0" />
                <p className="text-sm font-medium text-yellow-800">
                    This plate has been caught <span className="font-bold">{previousReportsForPlate.length} time{previousReportsForPlate.length > 1 ? 's' : ''}</span> before
                </p>
            </div>

            {/* Reports List */}
            <div className="flex-1 p-6 space-y-4 overflow-auto">
              {previousReportsForPlate.map((report, index) => {
                const date = new Date(report.timestamp);
                const formattedDate = date.toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric', 
                  year: 'numeric' 
                });
                const formattedTime = date.toLocaleTimeString('en-US', { 
                  hour: 'numeric', 
                  minute: '2-digit',
                  hour12: true 
                });
                
                return (
                  <div key={report.id} className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm">
                    <div className="bg-zinc-100 px-4 py-2">
                      <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                        Report #{previousReportsForPlate.length - index}
                      </span>
                    </div>
                    <div className="p-4 space-y-3">
                      <div className="flex items-center gap-2 text-sm text-zinc-600">
                        <Calendar size={14} className="text-zinc-400" />
                        <span>{formattedDate} at {formattedTime}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-zinc-600">
                        <MapPin size={14} className="text-zinc-400" />
                        <span>
                          {report.location || 'Unknown'}, FL {report.coordinates ? `${report.coordinates.lat.toFixed(2)}°N` : ''}
                        </span>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Behaviors Caught:</p>
                        <div className="flex flex-wrap gap-2">
                          {report.behaviors.map(behaviorId => {
                            const behavior = BEHAVIORS.find(b => b.id === behaviorId);
                            return behavior ? (
                              <span key={behaviorId} className="inline-flex items-center gap-1 bg-red-50 text-red-700 text-xs font-bold px-3 py-1.5 rounded-full border border-red-200">
                                {behavior.name}
                              </span>
                            ) : null;
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Button */}
            <div 
              className="p-6 bg-white border-t border-zinc-200"
              style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}
            >
              <Button 
                fullWidth 
                size="lg"
                variant="secondary"
                onClick={() => setView(ViewState.CELEBRATION)}
                className="bg-yellow-500 hover:bg-yellow-600 text-zinc-900"
              >
                Got it
              </Button>
            </div>
          </div>
        );

      case ViewState.DEALS:
        const totalPointsDeals = reports.length * 50;
        
        return (
          <div className="min-h-screen bg-zinc-50 pb-24">
            <Header />
            <div className="p-6">
              <div className="flex justify-between items-end mb-6">
                 <h2 className="text-2xl font-display font-bold text-zinc-900">My Deals</h2>
                 <span className="text-xs font-bold bg-red-100 text-red-700 px-2 py-1 rounded">
                    {totalPointsDeals} / 500 points
                 </span>
              </div>

              <div className="space-y-4">
                {deals.map(deal => (
                  <div key={deal.id} className={`relative overflow-hidden rounded-2xl border transition-all ${deal.claimed ? 'bg-white border-zinc-200 opacity-100' : 'bg-zinc-100 border-transparent opacity-60'}`}>
                    <div className={`h-2 w-full ${deal.claimed ? 'bg-green-500' : 'bg-zinc-300'}`}></div>
                    <div className="p-5">
                      <div className="flex justify-between items-start mb-2">
                         <h3 className="font-bold text-zinc-400 text-xs uppercase tracking-wide">{deal.partnerName}</h3>
                         {deal.claimed ? (
                             <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">ACTIVE</span>
                         ) : (
                             <div className="flex items-center gap-1 text-zinc-400 text-xs">
                               <MapPin size={12} className="shrink-0" />
                               <span className="truncate">{deal.location}</span>
                             </div>
                         )}
                      </div>
                      <h4 className={`text-xl font-bold mb-1 ${deal.claimed ? 'text-zinc-900' : 'text-zinc-400'}`}>{deal.offer}</h4>
                      <p className="text-sm text-zinc-500">{deal.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 bg-gradient-to-br from-red-600 to-red-700 rounded-3xl p-6 text-white text-center shadow-lg shadow-red-200">
                 <h3 className="font-display font-bold text-xl mb-2">Want to unlock your deals?</h3>
                 <p className="text-sm opacity-90 mb-6">Catch more assholes to unlock premium partners.</p>
                 <Button onClick={() => setView(ViewState.HOME)} variant="secondary" size="sm" className="w-full">
                    Go Catch 'Em
                 </Button>
              </div>

              <div className="mt-6 bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
                <h3 className="font-bold text-lg mb-3 text-zinc-900">How to claim deals:</h3>
                <ol className="list-decimal list-outside pl-4 space-y-2 text-sm text-zinc-600 font-medium">
                    <li>Visit a partner location</li>
                    <li>Tap "Catch One" on the home screen</li>
                    <li>Scan the partner's QR code</li>
                    <li>Enjoy your reward!</li>
                </ol>
              </div>
            </div>
            
            {/* 500 Points Notice Modal */}
            {totalPointsDeals >= 500 && show500PointsNotice && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-8 z-50 animate-in fade-in duration-300">
                <div className="bg-white p-8 rounded-3xl shadow-xl max-w-sm w-full animate-in zoom-in duration-300">
                  <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6 text-yellow-600">
                    <Ticket size={40} />
                  </div>
                  
                  <h2 className="text-3xl font-display font-black text-zinc-900 italic mb-2 text-center">
                    You've racked up points!
                  </h2>
                  
                  <p className="text-zinc-600 font-medium mb-8 text-center">
                    We are working on unlocking your deals. Please come back.
                  </p>

                  <Button fullWidth onClick={() => setShow500PointsNotice(false)}>
                    Got it
                  </Button>
                </div>
              </div>
            )}
          </div>
        );

      case ViewState.LIVE:
        // Mock data to simulate community activity
        const MOCK_LIVE_REPORTS = [
            { id: 'm1', plateText: 'BAD DRVR', behaviors: ['lane_leaper'], location: 'Alton Rd', timestamp: Date.now() - 120000 },
            { id: 'm2', plateText: 'MIA 305', behaviors: ['unhinged_honker'], location: 'Ocean Dr', timestamp: Date.now() - 300000 },
            { id: 'm3', plateText: 'LUV 2SP', behaviors: ['speed_demon', 'texting_zombie'], location: 'I-95 South', timestamp: Date.now() - 900000 },
            { id: 'm4', plateText: 'TAX I66', behaviors: ['parking_menace'], location: 'Lincoln Rd', timestamp: Date.now() - 1500000 },
        ];
        
        // Combine real user reports with mock community reports
        const feedItems = [...reports, ...MOCK_LIVE_REPORTS].sort((a, b) => b.timestamp - a.timestamp);

        return (
          <div className="min-h-screen bg-zinc-50 pb-24">
            <Header />
            <div className="p-6">
               <div className="mb-6 flex justify-between items-end">
                 <div>
                    <h2 className="text-2xl font-display font-bold text-zinc-900">Live Activity</h2>
                    <p className="text-sm text-zinc-500">Real-time chaos from the streets.</p>
                 </div>
                 <div className="animate-pulse">
                     <div className="h-3 w-3 bg-red-600 rounded-full"></div>
                 </div>
               </div>
               
               <HeatMap reports={reports} />

               <div className="mt-8">
                  <h3 className="text-sm font-bold text-zinc-900 mb-4 flex items-center gap-2">
                    <Zap size={16} className="text-red-600" />
                    Live Feed
                  </h3>
                  
                  <div className="space-y-3">
                      {feedItems.map((item, idx) => {
                          const mainBehavior = BEHAVIORS.find(b => b.id === item.behaviors[0]) || BEHAVIORS[0];
                          const timeAgo = Math.floor((Date.now() - item.timestamp) / 60000);
                          const timeDisplay = timeAgo < 1 ? 'Just now' : `${timeAgo}m ago`;
                          
                          return (
                              <div key={idx} className="bg-white p-4 rounded-xl border border-zinc-100 shadow-sm flex items-start gap-4 animate-in slide-in-from-bottom-2 fade-in duration-500" style={{ animationDelay: `${idx * 100}ms` }}>
                                  <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center text-xl shrink-0">
                                      {mainBehavior.icon}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                      <div className="flex justify-between items-start">
                                          <h4 className="font-display font-black text-zinc-900 tracking-wide truncate">
                                              {item.plateText}
                                          </h4>
                                          <span className="text-[10px] font-bold text-zinc-400 whitespace-nowrap ml-2">{timeDisplay}</span>
                                      </div>
                                      <p className="text-xs font-bold text-red-600 truncate">{mainBehavior.name}</p>
                                      {item.behaviors.length > 1 && (
                                          <p className="text-[10px] text-zinc-400">+ {item.behaviors.length - 1} other behaviors</p>
                                      )}
                                      <div className="flex items-center gap-1 mt-1 text-zinc-500 text-xs truncate">
                                          <MapPin size={10} />
                                          <span className="truncate">{item.location || 'Unknown Location'}</span>
                                      </div>
                                  </div>
                              </div>
                          );
                      })}
                  </div>
               </div>
            </div>
          </div>
        );

      case ViewState.BADGES:
        const totalBadges = badges.length;
        const unlockedCount = badges.filter(b => b.unlocked).length;
        const progress = (unlockedCount / totalBadges) * 100;
        const totalPoints = reports.length * 50;
        
        // Data for Pie Chart
        const pieData = [
            { name: 'Unlocked', value: unlockedCount },
            { name: 'Locked', value: totalBadges - unlockedCount },
        ];
        const COLORS = ['#FFC700', '#F3F4F6'];

        return (
          <div className="min-h-screen bg-zinc-50 pb-24">
            <Header />
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                 <div>
                    <h2 className="text-2xl font-display font-bold text-zinc-900">Badges</h2>
                    <p className="text-sm text-zinc-500">Your Petty Hall of Shame.</p>
                 </div>
                 <div className="flex gap-6">
                    <div className="text-right">
                       <span className="text-xs font-bold text-zinc-400 uppercase">Total Earned</span>
                       <div className="text-2xl font-display font-black text-red-600">
                         {unlockedCount} <span className="text-zinc-300 text-lg">/ {totalBadges}</span>
                       </div>
                    </div>
                    <div className="text-right">
                       <span className="text-xs font-bold text-zinc-400 uppercase">Points</span>
                       <div className="text-2xl font-display font-black text-red-600">
                         {totalPoints}
                       </div>
                    </div>
                 </div>
              </div>

              {/* Progress Chart */}
               <div className="bg-white rounded-2xl p-4 shadow-sm border border-zinc-100 mb-6 flex items-center gap-4">
                  <div className="w-16 h-16">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                        <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={20}
                            outerRadius={30}
                            fill="#8884d8"
                            paddingAngle={5}
                            dataKey="value"
                            startAngle={90}
                            endAngle={-270}
                            stroke="none"
                        >
                            {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div>
                      <p className="text-sm font-bold text-zinc-800">Petty Level: {progress < 30 ? 'Novice' : progress < 70 ? 'Spotter' : 'Pro'}</p>
                      <p className="text-xs text-zinc-500">Keep catching to rank up.</p>
                  </div>
               </div>

              <div className="grid grid-cols-2 gap-4">
                {badges.map(badge => (
                  <div key={badge.id} className={`aspect-square rounded-2xl p-4 flex flex-col items-center justify-center text-center border-2 transition-all ${badge.unlocked ? 'bg-white border-yellow-400 shadow-sm' : 'bg-zinc-100 border-transparent opacity-60'}`}>
                     <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl mb-3 ${badge.unlocked ? 'bg-yellow-100' : 'bg-zinc-200 grayscale'}`}>
                        {badge.unlocked ? badge.icon : '🔒'}
                     </div>
                     <h3 className={`text-sm font-bold mb-1 leading-tight ${badge.unlocked ? 'text-zinc-900' : 'text-zinc-400'}`}>{badge.name}</h3>
                     <p className="text-[10px] text-zinc-500 leading-tight px-2">{badge.description}</p>
                     {badge.unlocked && <Check size={12} className="text-green-500 mt-2" />}
                  </div>
                ))}
              </div>

              <div className="mt-6">
                <Button 
                  fullWidth 
                  variant="secondary" 
                  onClick={() => {
                    setEditingReport(null);
                    setView(ViewState.EDITOR);
                  }}
                >
                  View My Reports
                </Button>
              </div>
            </div>
          </div>
        );

      case ViewState.SETTINGS:
          return (
            <div className="min-h-screen bg-zinc-50 pb-24">
                <Header />
                <div className="p-6">
                    <h2 className="text-2xl font-display font-bold text-zinc-900 mb-6">Settings</h2>
                    <p className="text-xs font-bold text-zinc-400 uppercase mb-2">General</p>
                    <div className="bg-white rounded-2xl border border-zinc-100 divide-y divide-zinc-50 overflow-hidden shadow-sm mb-6">
                        <button onClick={() => setView(ViewState.ONBOARDING)} className="w-full p-4 text-left flex justify-between items-center hover:bg-zinc-50 active:bg-zinc-100 transition-colors">
                            <span className="font-bold text-zinc-700">How to Play</span>
                            <ChevronRight size={16} className="text-zinc-400" />
                        </button>
                        <button onClick={() => setView(ViewState.BADGES)} className="w-full p-4 text-left flex justify-between items-center hover:bg-zinc-50 active:bg-zinc-100 transition-colors">
                            <span className="font-bold text-zinc-700">PettyDex Progress</span>
                            <ChevronRight size={16} className="text-zinc-400" />
                        </button>
                        <button onClick={() => { setEditingReport(null); setView(ViewState.EDITOR); }} className="w-full p-4 text-left flex justify-between items-center hover:bg-zinc-50 active:bg-zinc-100 transition-colors">
                            <span className="font-bold text-zinc-700">My Reports</span>
                            <ChevronRight size={16} className="text-zinc-400" />
                        </button>
                    </div>

                    {/* TEMPORARY DEBUG SECTION - Controlled by ENABLE_DEBUG_TOOLS feature flag */}
                    {ENABLE_DEBUG_TOOLS && (
                      <>
                        <p className="text-xs font-bold text-zinc-400 uppercase mb-2">Debug (Testing Only)</p>
                        <div className="bg-yellow-50 border-2 border-yellow-300 rounded-2xl border-dashed p-4 mb-6">
                            <p className="text-xs font-bold text-yellow-800 mb-3">⚠️ TESTING ONLY - Toggle ENABLE_DEBUG_TOOLS in constants.ts to hide</p>
                            <div className="space-y-2">
                                <Button
                                    onClick={() => {
                                        const mockReports = Array.from({ length: 10 }, (_, i) => ({
                                            id: `debug-${Date.now()}-${i}`,
                                            plateText: `TEST${String(i + 1).padStart(3, '0')}`,
                                            behaviors: ['lane_leaper'],
                                            timestamp: Date.now() - (i * 60000), // Stagger timestamps by 1 minute
                                            location: `Test Location ${i + 1}`,
                                            coordinates: { lat: 25.774 + (i * 0.001), lng: -80.133 + (i * 0.001) }
                                        }));
                                        setReports([...reports, ...mockReports]);
                                        alert(`Added 10 mock reports! Total points: ${(reports.length + 10) * 50}`);
                                    }}
                                    variant="secondary"
                                    fullWidth
                                    className="bg-yellow-500 hover:bg-yellow-600 text-zinc-900"
                                >
                                    Add 10 Mock Reports (500 Points)
                                </Button>
                                <Button
                                    onClick={() => {
                                        setReports([]);
                                        setShow500PointsNotice(false);
                                        alert('All reports cleared!');
                                    }}
                                    variant="outline"
                                    fullWidth
                                    className="border-yellow-600 text-yellow-700 hover:bg-yellow-100"
                                >
                                    Clear All Reports
                                </Button>
                                <Button
                                    onClick={() => {
                                        setShow500PointsNotice(false);
                                        alert('500 points notice reset! Navigate to Deals screen to see it again.');
                                    }}
                                    variant="outline"
                                    fullWidth
                                    className="border-yellow-600 text-yellow-700 hover:bg-yellow-100"
                                >
                                    Reset 500 Points Notice
                                </Button>
                            </div>
                        </div>
                      </>
                    )}

                    <p className="text-xs font-bold text-zinc-400 uppercase mb-2">Feedback & Support</p>
                    <div className="bg-gradient-to-br from-red-600 to-yellow-500 rounded-2xl p-6 text-white shadow-lg mb-6">
                        <div className="flex items-start gap-4 mb-4">
                            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center shrink-0">
                                <MessageSquare size={24} className="text-white" />
                            </div>
                            <div>
                                <h3 className="font-display font-bold text-lg mb-1">Help Us Improve!</h3>
                                <p className="text-sm text-white/90">Your feedback helps make Petty Patrol even better. Share issues, ideas, or just say hi.</p>
                            </div>
                        </div>
                        <Button 
                            onClick={() => {
                                setFeedbackText('');
                                setFeedbackImage(null);
                                setView(ViewState.FEEDBACK);
                            }} 
                            variant="secondary" 
                            fullWidth
                            className="bg-white text-red-600 border-0 hover:bg-white/90"
                        >
                            Give Feedback
                        </Button>
                    </div>

                    <div className="bg-white rounded-2xl border border-zinc-100 p-4 shadow-sm mb-6">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-zinc-100 rounded-full flex items-center justify-center shrink-0">
                                <Mail size={18} className="text-zinc-500" />
                            </div>
                            <div className="flex-1">
                                <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Need Help?</p>
                                <a 
                                    href="mailto:pettypatrolsupport@projectconvoy.info" 
                                    className="text-sm font-bold text-red-600 hover:text-red-700 transition-colors"
                                >
                                    pettypatrolsupport@projectconvoy.info
                                </a>
                            </div>
                        </div>
                    </div>

                    <p className="text-xs font-bold text-zinc-400 uppercase mb-2">Legal-ish</p>
                    <div className="bg-white rounded-2xl border border-zinc-100 p-4 shadow-sm space-y-3">
                        <p className="text-sm text-zinc-600 font-medium">
                            <span className="font-bold text-zinc-800">Drive safe. Seriously.</span> This app is for entertainment purposes only and should never be used while operating a vehicle. Only passengers should snap or report.
                        </p>
                        
                        <p className="text-sm text-zinc-600 font-medium">
                            <span className="font-bold text-zinc-800">Use your best judgment.</span> Report responsibly and at appropriate times—never when it compromises safety or distracts you from the road.
                        </p>
                        
                        <p className="text-sm text-zinc-600 font-medium">
                            <span className="font-bold text-zinc-800">This is a CLOSED BETA,</span> which means things may break, features may change, and we're counting on you to help us make it better. Your feedback is gold.
                        </p>
                        
                        <p className="text-sm text-zinc-600 font-medium">
                            <span className="font-bold text-zinc-800">Don't weaponize this.</span> Petty Patrol is about shared laughs and accountability—not harassment, stalking, or targeting individuals. Keep it fun and legal.
                        </p>
                        
                        <p className="text-sm text-zinc-500 italic">
                            By using this app, you agree to use it responsibly and at your own discretion. We're not liable for any misuse or real-world consequences of reported information.
                        </p>
                        
                        <p className="text-xs text-zinc-400 pt-2 border-t border-zinc-100">v1.0.0-beta (Miami Chaos Edition)</p>
                    </div>
                </div>
            </div>
          );

      case ViewState.FEEDBACK:
        const handleFeedbackImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
          const file = event.target.files?.[0];
          if (!file) return;
          
          const reader = new FileReader();
          reader.onloadend = () => {
            setFeedbackImage(reader.result as string);
          };
          reader.readAsDataURL(file);
          event.target.value = '';
        };

        const handleSubmitFeedback = () => {
          // Track feedback submission
          trackEvent('feedback_submitted', {
            hasScreenshot: !!feedbackImage,
            feedbackLength: feedbackText.length,
          });
          
          const subject = encodeURIComponent('Petty Patrol feedback report');
          const body = encodeURIComponent(
            `${feedbackText}\n\n` +
            `---\n` +
            `App Version: v1.0.0-beta\n` +
            `Platform: ${navigator.userAgent}\n` +
            (feedbackImage ? `\n[Screenshot attached - please attach the saved screenshot to this email]` : '')
          );
          
          window.location.href = `mailto:pettypatrolsupport@projectconvoy.info?subject=${subject}&body=${body}`;
        };

        return (
          <div className="min-h-screen bg-zinc-50 pb-32">
            {/* Red Header */}
            <div 
              className="bg-red-600 pb-4 px-6 flex justify-between items-center shadow-md sticky top-0 z-50"
              style={{ paddingTop: 'calc(3rem + env(safe-area-inset-top, 0px))' }}
            >
               <h2 className="text-xl font-display font-bold text-white">Give Feedback</h2>
               <button 
                 onClick={() => setView(ViewState.SETTINGS)} 
                 className="text-white/90 hover:text-white hover:bg-red-700/50 rounded-full p-2 transition-colors"
               >
                 <X size={24} />
               </button>
            </div>

            <div className="p-6">
              {/* Feedback Message */}
              <div className="mb-6">
                <label className="block text-sm font-bold text-zinc-900 mb-2">
                  Your Feedback
                </label>
                <textarea
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder="Tell us what's on your mind... Issues, feature ideas, or just let us know how we're doing!"
                  className="w-full h-40 p-4 border-2 border-zinc-200 rounded-xl focus:border-red-600 focus:ring-4 focus:ring-red-50 outline-none text-zinc-900 placeholder:text-zinc-400 resize-none transition-all"
                />
              </div>

              {/* Screenshot Attachment */}
              <div className="mb-6">
                <p className="block text-sm font-bold text-zinc-900 mb-2">
                  Attach Screenshot <span className="text-zinc-400 font-normal">(optional)</span>
                </p>

                {feedbackImage ? (
                  <div className="relative">
                    <img 
                      src={feedbackImage} 
                      alt="Feedback screenshot" 
                      className="w-full aspect-video object-cover rounded-xl border-2 border-zinc-200"
                    />
                    <button 
                      onClick={() => setFeedbackImage(null)}
                      className="absolute top-2 right-2 w-8 h-8 bg-red-600 rounded-full flex items-center justify-center text-white shadow-lg hover:bg-red-700 transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <label className="relative w-full p-6 border-2 border-dashed border-zinc-300 rounded-xl flex flex-col items-center gap-2 hover:border-red-400 hover:bg-red-50/50 transition-colors cursor-pointer">
                    <input 
                      type="file" 
                      ref={feedbackFileInputRef}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                      accept="image/*"
                      onChange={handleFeedbackImageChange}
                    />
                    <div className="w-12 h-12 bg-zinc-100 rounded-full flex items-center justify-center pointer-events-none">
                      <ImageIcon size={24} className="text-zinc-400" />
                    </div>
                    <span className="text-sm font-medium text-zinc-500 pointer-events-none">Tap to add a screenshot</span>
                  </label>
                )}
              </div>

              {/* Instructions */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
                <p className="text-sm text-yellow-800">
                  <span className="font-bold">Note:</span> When you submit, your email app will open with your feedback pre-filled. 
                  {feedbackImage && " Don't forget to attach the screenshot you selected!"}
                </p>
              </div>

              {/* Support Email Info */}
              <div className="bg-zinc-100 rounded-xl p-4 mb-6 flex items-center gap-3">
                <Mail size={18} className="text-zinc-500 shrink-0" />
                <div>
                  <p className="text-xs text-zinc-500">Sending to:</p>
                  <p className="text-sm font-bold text-zinc-700">pettypatrolsupport@projectconvoy.info</p>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div 
              className="fixed bottom-0 left-0 right-0 p-6 bg-white/90 backdrop-blur border-t border-zinc-200 z-20"
              style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}
            >
              <div className="max-w-md mx-auto">
                <Button 
                  fullWidth 
                  size="lg" 
                  onClick={handleSubmitFeedback}
                  disabled={!feedbackText.trim()}
                >
                  Submit Feedback
                </Button>
              </div>
            </div>
          </div>
        );

      case ViewState.EDITOR:
        const handleSaveReport = () => {
          if (!editingReport) return;
          if (editBehaviors.length === 0) {
            alert("Please select at least one behavior.");
            return;
          }
          if (!editLocation) {
            alert("Please select a location.");
            return;
          }

          const updatedReports = reports.map(r => 
            r.id === editingReport.id 
              ? {
                  ...r,
                  plateText: editPlateText,
                  behaviors: editBehaviors,
                  customNote: editCustomNote || undefined,
                  location: editLocation.address,
                  coordinates: { lat: editLocation.lat, lng: editLocation.lng }
                }
              : r
          );
          setReports(updatedReports);
          
          // Track report edit
          trackEvent('report_edited', { 
            reportId: editingReport.id,
            behaviorsCount: editBehaviors.length,
          });
          
          setEditingReport(null);
          setView(ViewState.EDITOR);
        };

        const handleDeleteReport = () => {
          if (!editingReport) return;
          if (confirm("Are you sure you want to delete this report?")) {
            // Track report deletion
            trackEvent('report_deleted', { 
              reportId: editingReport.id,
              plateText: editingReport.plateText,
            });
            
            setReports(reports.filter(r => r.id !== editingReport.id));
            setEditingReport(null);
            setView(ViewState.EDITOR);
          }
        };

        if (editingReport) {
          // Edit mode
          const isOtherSelected = editBehaviors.includes('other_custom');
          const isOtherOnly = editBehaviors.length === 1 && isOtherSelected;
          const isOtherValid = !isOtherOnly || (isOtherOnly && editCustomNote.trim().length > 0);
          const isFormValid = editBehaviors.length > 0 && isOtherValid && editLocation !== null;

          return (
            <div className="min-h-screen bg-zinc-50 pb-32">
              <div className="bg-white p-4 shadow-sm border-b border-zinc-100 sticky top-0 z-10">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-display font-bold text-zinc-900">Edit Report</h2>
                  <button onClick={() => { setEditingReport(null); }} className="text-zinc-400 hover:text-zinc-600">
                    <X size={24} />
                  </button>
                </div>
              </div>

              <div className="p-6">
                <div className="mb-6">
                  <label className="block text-sm font-bold text-zinc-900 mb-2">
                    License Plate Number <span className="text-red-600">*</span>
                  </label>
                  <input 
                    type="text" 
                    value={editPlateText}
                    onChange={(e) => {
                      const sanitized = e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
                      setEditPlateText(sanitized);
                    }}
                    className="w-full text-2xl font-display font-black text-center border-2 border-zinc-200 rounded-xl focus:border-red-600 focus:ring-4 focus:ring-red-50 outline-none py-3 text-zinc-900"
                  />
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-lg border border-zinc-100 mb-4">
                  <div className="flex justify-between items-center mb-4">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">Edit Location <span className="text-red-600">*</span></label>
                    {editLocation && (
                      <span className="text-xs font-bold text-red-600 flex items-center gap-1">
                        <MapPin size={12} /> {editLocation.address}
                      </span>
                    )}
                  </div>
                  
                  <div className="w-full h-48 rounded-xl relative overflow-hidden border border-zinc-200">
                    <LeafletPicker 
                      onLocationSelect={(lat, lng) => {
                        const address = getAddressFromCoords(lat, lng);
                        setEditLocation({ lat, lng, address });
                      }} 
                      initialLat={editLocation?.lat}
                      initialLng={editLocation?.lng}
                    />
                    
                    {!editLocation && (
                      <div className="absolute top-2 left-2 z-[400] bg-white/90 px-3 py-1.5 rounded-lg text-xs font-bold text-zinc-500 shadow-sm pointer-events-none">
                        Tap map to pin location
                      </div>
                    )}
                  </div>
                </div>

                <h3 className="text-sm font-bold text-zinc-500 mb-4 uppercase tracking-wider mt-6">Behaviors <span className="text-red-600">*</span></h3>
                <div className="space-y-3 mb-6">
                  {BEHAVIORS.map(b => {
                    const isSelected = editBehaviors.includes(b.id);
                    const isOther = b.id === 'other_custom';
                    return (
                      <div key={b.id} className="w-full">
                        <button
                          onClick={() => {
                            setEditBehaviors(prev => 
                              prev.includes(b.id) ? prev.filter(id => id !== b.id) : [...prev, b.id]
                            );
                          }}
                          className={`w-full text-left p-4 rounded-xl border-2 transition-all flex items-start gap-4 ${
                            isSelected 
                              ? 'border-red-600 bg-red-50' 
                              : 'border-white bg-white shadow-sm hover:border-zinc-200'
                          }`}
                        >
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl shrink-0 ${isSelected ? 'bg-red-200' : 'bg-zinc-100'}`}>
                            {b.icon}
                          </div>
                          <div className="flex-1">
                            <h4 className={`font-bold ${isSelected ? 'text-red-900' : 'text-zinc-800'}`}>{b.name}</h4>
                            <p className="text-xs text-zinc-500">{b.description}</p>
                          </div>
                          {isSelected && <Check className="text-red-600 mt-1" size={20} />}
                        </button>
                        {isOther && isSelected && (
                          <div className="mt-2 ml-2 pl-4 border-l-2 border-red-200">
                            <input
                              type="text"
                              placeholder="What exactly did they do?"
                              value={editCustomNote}
                              onChange={(e) => setEditCustomNote(e.target.value)}
                              className="w-full p-3 bg-white border border-zinc-200 rounded-lg text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-red-500"
                            />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" fullWidth onClick={handleDeleteReport}>
                    Delete
                  </Button>
                  <Button fullWidth onClick={handleSaveReport} disabled={!isFormValid}>
                    Save Changes
                  </Button>
                </div>
              </div>
            </div>
          );
        }

        // List mode - show all reports
        return (
          <div className="min-h-screen bg-zinc-50 pb-24">
            <Header />
            <div className="p-6">
              <div className="flex justify-between items-end mb-6">
                <h2 className="text-2xl font-display font-bold text-zinc-900">My Reports</h2>
                <span className="text-xs font-bold bg-zinc-200 px-2 py-1 rounded text-zinc-600">
                  {reports.length} Total
                </span>
              </div>

              {reports.length === 0 ? (
                <div className="bg-white rounded-2xl p-8 text-center border border-zinc-100">
                  <p className="text-zinc-500 font-medium mb-4">No reports yet</p>
                  <Button onClick={() => setView(ViewState.HOME)} variant="outline">
                    Catch Your First One
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {reports.map((report) => {
                    const mainBehavior = BEHAVIORS.find(b => b.id === report.behaviors[0]) || BEHAVIORS[0];
                    const date = new Date(report.timestamp);
                    const timeDisplay = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    
                    return (
                      <div 
                        key={report.id} 
                        className="bg-white p-4 rounded-xl border border-zinc-100 shadow-sm cursor-pointer hover:border-red-200 transition-colors"
                        onClick={() => {
                          setEditingReport(report);
                        }}
                      >
                        <div className="flex items-start gap-4">
                          <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center text-xl shrink-0">
                            {mainBehavior.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start mb-1">
                              <h4 className="font-display font-black text-zinc-900 tracking-wide">
                                {report.plateText}
                              </h4>
                              <ChevronRight size={16} className="text-zinc-400 shrink-0" />
                            </div>
                            <p className="text-xs font-bold text-red-600 mb-1">{mainBehavior.name}</p>
                            {report.behaviors.length > 1 && (
                              <p className="text-[10px] text-zinc-400 mb-1">+ {report.behaviors.length - 1} other behaviors</p>
                            )}
                            <div className="flex items-center gap-1 text-zinc-500 text-xs mt-2">
                              <MapPin size={10} />
                              <span className="truncate">{report.location || 'Unknown Location'}</span>
                            </div>
                            <p className="text-[10px] text-zinc-400 mt-1">{timeDisplay}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
        
      default:
        return <div>View not implemented</div>;
    }
  };

  return (
    <div className="max-w-md mx-auto min-h-screen bg-zinc-50 shadow-2xl relative overflow-hidden">
      {renderContent()}
      
      {/* Hide Bottom Nav on Onboarding, Capture Process, Feedback, and Editor Edit Mode */}
      {view !== ViewState.ONBOARDING && 
       view !== ViewState.ANALYZING && 
       view !== ViewState.BEHAVIOR_PICKER && 
       view !== ViewState.CELEBRATION && 
       view !== ViewState.MANUAL_ENTRY && 
       view !== ViewState.LOCATION_PICKER &&
       view !== ViewState.PREVIOUS_REPORTS &&
       view !== ViewState.FEEDBACK &&
       !(view === ViewState.EDITOR && editingReport) && (
        <BottomNav currentView={view} onNavigate={setView} />
      )}
    </div>
  );
};

export default App;