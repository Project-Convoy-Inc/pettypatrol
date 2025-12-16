import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { base64Content, mimeType } = req.body;

  if (!base64Content || !mimeType) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  
  if (!GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY is not set');
    return res.status(500).json({ error: 'API key not configured' });
  }

  const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

  try {
    const response = await fetch(
      `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Analyze this image and determine:
1. If there's a license plate visible, extract the plate text (letters and numbers only, uppercase, no spaces or special characters)
2. If there's a QR code visible, extract the QR code content
3. If neither is clearly visible, respond with "INVALID"

Respond in JSON format:
{
  "type": "LICENSE_PLATE" | "QR_CODE" | "INVALID",
  "value": "extracted text or QR content",
  "confidence": 0.0-1.0
}

Image data: data:${mimeType};base64,${base64Content}`
            }]
          }]
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.statusText}`);
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
  } catch (error) {
    console.error('Error analyzing image:', error);
    return res.status(500).json({ error: 'Failed to analyze image' });
  }
}

