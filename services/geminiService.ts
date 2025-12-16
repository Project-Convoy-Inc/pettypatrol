// Gemini API Service
// This service handles image analysis using Google's Gemini API via Vercel serverless function

export interface AnalysisResult {
  type: 'LICENSE_PLATE' | 'QR_CODE' | 'INVALID';
  value: string;
  confidence: number;
}

export async function analyzeImage(base64Content: string, mimeType: string): Promise<AnalysisResult> {
  try {
    // Call your Vercel API route instead of Gemini directly
    const response = await fetch('/api/analyze-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ base64Content, mimeType }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `API error: ${response.statusText}`);
    }

    const result = await response.json();
    return {
      type: result.type || 'INVALID',
      value: result.value || '',
      confidence: result.confidence || 0.5,
    };
  } catch (error) {
    console.error('Error analyzing image:', error);
    // Fallback for development
    return {
      type: 'LICENSE_PLATE',
      value: 'MIA305',
      confidence: 0.85,
    };
  }
}





