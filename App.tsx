import React, { useState, useEffect, useRef } from 'react';
import { ViewState, AnalysisResult, AnalysisType, Badge, Deal, LicensePlateReport } from './types';
import { BEHAVIORS, INITIAL_BADGES, INITIAL_DEALS } from './constants';
import { analyzeImage } from './services/geminiService';
import BottomNav from './components/BottomNav';
import Button from './components/Button';
import HeatMap from './components/HeatMap';
import { Camera, X, Check, Award, AlertTriangle, AlertCircle, MapPin, ChevronRight, Upload, Ticket, Keyboard, Settings as SettingsIcon, Activity, Zap } from 'lucide-react';
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
                zoomControl: false,
                attributionControl: false
            });

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
            }).addTo(mapRef.current);

            // Custom Icon
            const icon = L.divIcon({
                className: 'bg-transparent',
                html: `<div class="w-8 h-8 bg-red-600 rounded-full border-4 border-white shadow-lg transform -translate-x-1/2 -translate-y-1/2"></div>`,
                iconSize: [0, 0] // Handled by HTML
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

        // Fix tiles on resize
        setTimeout(() => {
            mapRef.current?.invalidateSize();
        }, 100);

    }, []);

    return <div ref={mapContainerRef} className="w-full h-full bg-zinc-100" />;
};


// --- View Components ---

const Header: React.FC = () => (
  <header className="pt-8 pb-4 px-6 bg-white sticky top-0 z-40 border-b border-zinc-100">
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
  <div className="h-screen bg-red-600 text-white p-8 flex flex-col justify-center items-center text-center">
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
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCaptureClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setView(ViewState.ANALYZING);
    setAnalyzing(true);
    
    // Reset location for new capture so user is prompted
    setSelectedLocation(null);

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      setCurrentImage(base64String);
      
      // Send to Gemini
      const base64Content = base64String.split(',')[1];
      const result = await analyzeImage(base64Content, file.type);
      
      setAnalysisResult(result);
      setAnalyzing(false);

      if (result.type === AnalysisType.LICENSE_PLATE) {
        setView(ViewState.BEHAVIOR_PICKER);
      } else if (result.type === AnalysisType.QR_CODE) {
        handleQrClaim(result.value);
      } else {
        // Stay on analyzing screen but show error with PRD text
        setTimeout(() => {
            alert("Hmm. That’s not a plate or a partner QR.");
            setView(ViewState.HOME);
        }, 500);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleQrClaim = (qrValue: string) => {
    const matchedDeal = deals.find(d => d.qrCodeId === qrValue || qrValue.includes(d.qrCodeId));
    
    if (matchedDeal) {
      if(matchedDeal.claimed) {
          alert("You already claimed this deal!");
          setView(ViewState.DEALS);
          return;
      }
      const updatedDeals = deals.map(d => d.id === matchedDeal.id ? { ...d, claimed: true } : d);
      setDeals(updatedDeals);
      setAnalysisResult({ type: AnalysisType.QR_CODE, value: matchedDeal.partnerName, confidence: 1 });
      setView(ViewState.CELEBRATION);
    } else {
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

    const newReport: LicensePlateReport = {
      id: Date.now().toString(),
      plateText: analysisResult?.value || 'UNKNOWN',
      behaviors: selectedBehaviors,
      customNote: isOtherSelected ? customNote : undefined,
      timestamp: Date.now(),
      location: selectedLocation.address,
      coordinates: { lat: selectedLocation.lat, lng: selectedLocation.lng }
    };

    setReports([newReport, ...reports]);
    
    // Check for badges
    let newBadgesUnlocked = false;
    const updatedBadges = badges.map(badge => {
      if (badge.unlocked) return badge;
      
      if (badge.id === 'first_catch') {
        newBadgesUnlocked = true;
        return { ...badge, unlocked: true };
      }

      if (badge.requiredBehaviorId && selectedBehaviors.includes(badge.requiredBehaviorId)) {
        newBadgesUnlocked = true;
        return { ...badge, unlocked: true };
      }

      if (badge.id === 'legendary' && selectedBehaviors.length >= 4) {
         newBadgesUnlocked = true;
         return { ...badge, unlocked: true };
      }

      return badge;
    });

    if (newBadgesUnlocked) setBadges(updatedBadges);
    
    setView(ViewState.CELEBRATION);
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
        return <Onboarding onComplete={() => setView(ViewState.HOME)} />;
      
      case ViewState.HOME:
        return (
          <div className="min-h-screen bg-zinc-50 pb-24">
            <Header />
            <div className="flex flex-col items-center justify-center h-[70vh] px-6">
              <input 
                type="file" 
                ref={fileInputRef}
                className="hidden" 
                accept="image/*" 
                capture="environment"
                onChange={handleFileChange}
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

              <div className="mt-8 flex flex-col items-center gap-4 w-full">
                <button onClick={handleCaptureClick} className="text-sm font-bold text-zinc-500 underline decoration-2 decoration-zinc-300 underline-offset-4 active:text-red-600 transition-colors">
                  Upload Photo Instead
                </button>
                <button onClick={() => { 
                    setManualPlateText(''); 
                    setSelectedLocation(null);
                    setView(ViewState.MANUAL_ENTRY); 
                  }} className="text-sm font-bold text-zinc-500 underline decoration-2 decoration-zinc-300 underline-offset-4 active:text-red-600 transition-colors">
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
                <div className="bg-red-600 pt-12 pb-4 px-6 flex justify-between items-center shadow-md sticky top-0 z-50">
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
                            placeholder="MIA305"
                            autoFocus
                        />
                    </div>

                    {/* Location Section */}
                    {renderLocationSection("Where did it happen?")}

                    {/* Warning Box */}
                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-8 flex items-center justify-center text-center">
                        <p className="text-sm text-yellow-800 font-medium">
                        Manual entry for when you cannot take a photo
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
                                alert("Please tap the map to pin where this happened.");
                                return;
                            }
                            setAnalysisResult({
                                type: AnalysisType.LICENSE_PLATE,
                                value: manualPlateText.toUpperCase(),
                                confidence: 1.0
                            });
                            setView(ViewState.BEHAVIOR_PICKER);
                        }}
                    >
                        Continue
                    </Button>
                </div>
            </div>
        );

      case ViewState.ANALYZING:
        return (
          <div className="h-screen bg-white flex flex-col items-center justify-center p-8">
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
             <div className="bg-white p-4 shadow-sm border-b border-zinc-100 sticky top-0 z-10">
                <div className="flex items-center gap-4">
                  {currentImage ? (
                    <img src={currentImage} className="w-16 h-16 rounded-lg object-cover bg-zinc-100" />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-red-100 flex items-center justify-center text-red-600">
                        <Keyboard size={24} />
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-bold text-zinc-400 uppercase">License Plate Detected</p>
                    <h2 className="text-3xl font-display font-black text-zinc-900 tracking-wider">
                      {analysisResult?.value || "UNKNOWN"}
                    </h2>
                  </div>
                </div>
             </div>

             <div className="p-6">
                {renderLocationSection(selectedLocation ? "Confirm Location" : "Where did it happen?")}

                <h3 className="text-sm font-bold text-zinc-500 mb-4 uppercase tracking-wider mt-6">Check all that apply <span className="text-red-600">*</span></h3>
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

             <div className="fixed bottom-0 left-0 right-0 p-6 bg-white/90 backdrop-blur border-t border-zinc-200 z-20">
                <div className="max-w-md mx-auto flex gap-3">
                  <Button variant="outline" fullWidth onClick={() => { setView(ViewState.HOME); setSelectedBehaviors([]); setCustomNote(''); setSelectedLocation(null); }}>Cancel</Button>
                  <Button fullWidth onClick={submitReport} disabled={!isFormValid}>Submit Report</Button>
                </div>
             </div>
          </div>
        );

      case ViewState.CELEBRATION:
        const isQr = analysisResult?.type === AnalysisType.QR_CODE;
        return (
          <div className="min-h-screen bg-yellow-400 flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in duration-300">
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

      case ViewState.DEALS:
        return (
          <div className="min-h-screen bg-zinc-50 pb-24">
            <Header />
            <div className="p-6">
              <div className="flex justify-between items-end mb-6">
                 <h2 className="text-2xl font-display font-bold text-zinc-900">My Deals</h2>
                 <span className="text-xs font-bold bg-zinc-200 px-2 py-1 rounded text-zinc-600">
                    {deals.filter(d => d.claimed).length} Claimed
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
                 <h3 className="font-display font-bold text-xl mb-2">Want more deals?</h3>
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
                 <div className="text-right">
                    <span className="text-xs font-bold text-zinc-400 uppercase">Total Earned</span>
                    <div className="text-2xl font-display font-black text-red-600">
                      {unlockedCount} <span className="text-zinc-300 text-lg">/ {totalBadges}</span>
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
                      <p className="text-sm font-bold text-zinc-800">Petty Level: {progress < 30 ? 'Novice' : progress < 70 ? 'Officer' : 'Chief'}</p>
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
                    </div>

                    <p className="text-xs font-bold text-zinc-400 uppercase mb-2">Legal-ish</p>
                    <div className="bg-white rounded-2xl border border-zinc-100 p-4 shadow-sm">
                        <p className="text-sm text-zinc-600 mb-2 font-medium">Don't be weird. Drive safe. This app is for entertainment purposes only. Do not use while driving.</p>
                        <p className="text-xs text-zinc-400">v1.0.0 (Miami Chaos Edition)</p>
                    </div>
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
      
      {/* Hide Bottom Nav on Onboarding, Capture Process */}
      {view !== ViewState.ONBOARDING && 
       view !== ViewState.ANALYZING && 
       view !== ViewState.BEHAVIOR_PICKER && 
       view !== ViewState.CELEBRATION && 
       view !== ViewState.MANUAL_ENTRY && (
        <BottomNav currentView={view} onNavigate={setView} />
      )}
    </div>
  );
};

export default App;