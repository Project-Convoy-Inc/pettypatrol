import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { lat, lng } = req.body;

  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return res.status(400).json({ error: 'Invalid coordinates. lat and lng must be numbers' });
  }

  const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
  
  if (!GOOGLE_MAPS_API_KEY) {
    console.error('GOOGLE_MAPS_API_KEY is not set');
    return res.status(500).json({ error: 'Google Maps API key not configured' });
  }

  const GEOCODING_API_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

  try {
    // Add timeout to prevent hanging requests (10 seconds)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(
      `${GEOCODING_API_URL}?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}&result_type=street_address|intersection|route`,
      {
        method: 'GET',
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Google Maps API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (data.status === 'ZERO_RESULTS') {
      return res.status(200).json({ 
        address: null,
        formattedAddress: null,
        status: 'ZERO_RESULTS'
      });
    }

    if (data.status !== 'OK') {
      console.error('Google Maps Geocoding API error:', data.status, data.error_message);
      return res.status(500).json({ 
        error: `Geocoding failed: ${data.status}`,
        details: data.error_message 
      });
    }

    // Extract the most relevant address
    const result = data.results[0];
    const formattedAddress = result.formatted_address;
    
    // Try to extract a simplified intersection format
    let simplifiedAddress = formattedAddress;
    
    // Look for intersection format in address components
    const routeComponent = result.address_components.find(
      (comp: any) => comp.types.includes('route')
    );
    const streetNumberComponent = result.address_components.find(
      (comp: any) => comp.types.includes('street_number')
    );
    
    if (routeComponent && streetNumberComponent) {
      simplifiedAddress = `${streetNumberComponent.long_name} ${routeComponent.long_name}`;
    } else if (routeComponent) {
      // Try to find intersecting street
      const intersectionMatch = formattedAddress.match(/(.+?)\s+&\s+(.+)/);
      if (intersectionMatch) {
        simplifiedAddress = intersectionMatch[0];
      } else {
        simplifiedAddress = routeComponent.long_name;
      }
    }

    return res.status(200).json({
      address: simplifiedAddress,
      formattedAddress: formattedAddress,
      status: 'OK'
    });

  } catch (error: any) {
    console.error('Error in geocoding:', error);
    
    if (error.name === 'AbortError') {
      return res.status(504).json({ error: 'Request timeout' });
    }

    return res.status(500).json({ 
      error: 'Geocoding service error',
      details: error.message 
    });
  }
}
