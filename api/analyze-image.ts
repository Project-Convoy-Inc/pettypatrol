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

  const { base64Content, mimeType } = req.body;

  if (!base64Content || !mimeType) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Validate base64 content size (max 10MB base64 = ~7.5MB actual)
  const maxBase64Size = 10 * 1024 * 1024; // 10MB
  if (base64Content.length > maxBase64Size) {
    return res.status(400).json({ error: 'Image too large. Maximum size is 10MB' });
  }

  // Validate mime type
  const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!allowedMimeTypes.includes(mimeType)) {
    return res.status(400).json({ error: 'Invalid image type. Only JPEG, PNG, and WebP are supported' });
  }

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  
  if (!GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY is not set');
    return res.status(500).json({ error: 'API key not configured' });
  }

  const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent';

  try {
    // Add timeout to prevent hanging requests (30 seconds)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const requestBody = {
      contents: [{
        parts: [
          {
            text: `Analyze this image and determine:
1. If there's a license plate visible, extract the plate text (letters and numbers only, uppercase, no spaces or special characters)
2. If there's a QR code visible, extract the QR code content
3. If neither is clearly visible, respond with "INVALID"

Respond in JSON format:
{
  "type": "LICENSE_PLATE" | "QR_CODE" | "INVALID",
  "value": "extracted text or QR content",
  "confidence": 0.0-1.0
}`
          },
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Content
            }
          }
        ]
      }]
    };

    const response = await fetch(
      `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify(requestBody),
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error('Gemini API error:', response.status, errorText);
      
      // Provide user-friendly error messages
      if (response.status === 429) {
        return res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
      }
      if (response.status === 400) {
        return res.status(400).json({ error: 'Invalid request. Please check your image.' });
      }
      if (response.status === 401 || response.status === 403) {
        return res.status(500).json({ error: 'API authentication failed' });
      }
      
      throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    // Try to parse JSON from the response
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return res.status(200).json({
          type: parsed.type || 'INVALID',
          value: parsed.value || '',
          confidence: parsed.confidence || 0.5,
        });
      }
    } catch (e) {
      console.error('Failed to parse JSON from Gemini response', e);
    }

    // Fallback: try to detect license plate or QR code from text
    const upperText = text.toUpperCase();
    if (upperText.includes('LICENSE') || upperText.includes('PLATE')) {
      const plateMatch = upperText.match(/[A-Z0-9]{2,8}/);
      if (plateMatch) {
        return res.status(200).json({
          type: 'LICENSE_PLATE',
          value: plateMatch[0],
          confidence: 0.7,
        });
      }
    }

    if (upperText.includes('QR') || upperText.includes('PARTNER')) {
      return res.status(200).json({
        type: 'QR_CODE',
        value: text.trim(),
        confidence: 0.7,
      });
    }

    return res.status(200).json({
      type: 'INVALID',
      value: '',
      confidence: 0.0,
    });
  } catch (error: any) {
    console.error('Error analyzing image:', error);
    
    // Handle timeout
    if (error.name === 'AbortError') {
      return res.status(504).json({ error: 'Request timeout. Please try again.' });
    }
    
    // Handle network errors
    if (error.message?.includes('fetch')) {
      return res.status(503).json({ error: 'Service temporarily unavailable. Please try again later.' });
    }
    
    return res.status(500).json({ error: 'Failed to analyze image. Please try again.' });
  }
}

