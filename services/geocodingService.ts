// Geocoding Service
// This service handles reverse geocoding (coordinates to address) using Google Maps API via Vercel serverless function

export interface GeocodingResult {
  address: string | null;
  formattedAddress: string | null;
  status: string;
}

export async function getAddressFromCoordinates(lat: number, lng: number): Promise<string> {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/bbeae9bf-8eb7-41dc-9639-4ea255cdd7a2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'geocodingService.ts:10',message:'getAddressFromCoordinates called',data:{lat,lng},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  
  // Try server-side API first, fallback to client-side if it fails
  try {
    const apiUrl = '/api/geocode';
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/bbeae9bf-8eb7-41dc-9639-4ea255cdd7a2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'geocodingService.ts:15',message:'Calling geocode API',data:{apiUrl,lat,lng},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ lat, lng }),
    });

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/bbeae9bf-8eb7-41dc-9639-4ea255cdd7a2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'geocodingService.ts:25',message:'Geocode API response received',data:{status:response.status,statusText:response.statusText,ok:response.ok},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

    if (response.ok) {
      const result: GeocodingResult = await response.json();
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/bbeae9bf-8eb7-41dc-9639-4ea255cdd7a2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'geocodingService.ts:32',message:'Geocode result parsed',data:{result,address:result.address,status:result.status},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      
      if (result.status === 'OK' && result.address) {
        return result.address;
      }
    } else {
      // Server API failed, get error details and throw to trigger client-side fallback
      const errorData = await response.json().catch(() => ({ error: response.statusText }));
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/bbeae9bf-8eb7-41dc-9639-4ea255cdd7a2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'geocodingService.ts:44',message:'Server API returned error, will try client-side',data:{errorData,status:response.status},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      throw new Error(errorData.error || `Server API error: ${response.status}`);
    }
  } catch (apiError) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/bbeae9bf-8eb7-41dc-9639-4ea255cdd7a2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'geocodingService.ts:40',message:'Server API failed, trying client-side',data:{error:apiError instanceof Error ? apiError.message : String(apiError)},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    console.warn('Server-side geocoding failed, trying client-side:', apiError);
  }

  // Fallback to client-side geocoding (for local development or if server route fails)
  try {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/bbeae9bf-8eb7-41dc-9639-4ea255cdd7a2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'geocodingService.ts:53',message:'Checking for client-side API key',data:{hasApiKey:!!apiKey,apiKeyLength:apiKey?.length || 0},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    if (!apiKey) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/bbeae9bf-8eb7-41dc-9639-4ea255cdd7a2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'geocodingService.ts:57',message:'API key missing - need VITE_GOOGLE_MAPS_API_KEY in .env.local',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      throw new Error('Google Maps API key not configured. Please set VITE_GOOGLE_MAPS_API_KEY in your .env.local file');
    }

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/bbeae9bf-8eb7-41dc-9639-4ea255cdd7a2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'geocodingService.ts:50',message:'Calling Google Maps Geocoding API directly',data:{lat,lng,hasApiKey:!!apiKey},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`
    );

    if (!response.ok) {
      throw new Error(`Google Maps API error: ${response.status}`);
    }

    const data = await response.json();

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/bbeae9bf-8eb7-41dc-9639-4ea255cdd7a2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'geocodingService.ts:62',message:'Google Maps API response',data:{status:data.status,resultsCount:data.results?.length},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const result = data.results[0];
      const formattedAddress = result.formatted_address;
      
      // Try to simplify to street address or intersection
      const routeComponent = result.address_components.find(
        (comp: any) => comp.types.includes('route')
      );
      const streetNumberComponent = result.address_components.find(
        (comp: any) => comp.types.includes('street_number')
      );
      
      let simplifiedAddress = formattedAddress;
      if (routeComponent && streetNumberComponent) {
        simplifiedAddress = `${streetNumberComponent.long_name} ${routeComponent.long_name}`;
      } else if (routeComponent) {
        const intersectionMatch = formattedAddress.match(/(.+?)\s+&\s+(.+)/);
        if (intersectionMatch) {
          simplifiedAddress = intersectionMatch[0];
        } else {
          simplifiedAddress = routeComponent.long_name;
        }
      }

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/bbeae9bf-8eb7-41dc-9639-4ea255cdd7a2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'geocodingService.ts:85',message:'Address extracted successfully',data:{simplifiedAddress,formattedAddress},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A'})}).catch(()=>{});
      // #endregion

      return simplifiedAddress;
    }

    throw new Error(`No results: ${data.status}`);
  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/bbeae9bf-8eb7-41dc-9639-4ea255cdd7a2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'geocodingService.ts:95',message:'All geocoding methods failed',data:{error:error instanceof Error ? error.message : String(error),lat,lng},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    console.error('Error geocoding coordinates:', error);
    // Fallback to coordinates if all geocoding fails
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
}
