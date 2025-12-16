// Gemini API Service
// This service handles image analysis using Google's Gemini API via Vercel serverless function

import { AnalysisType, AnalysisResult as AppAnalysisResult } from '../types';

export async function analyzeImage(base64Content: string, mimeType: string): Promise<AppAnalysisResult> {
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
    
    // Convert string type to enum
    let typeEnum: AnalysisType;
    if (result.type === 'LICENSE_PLATE') {
      typeEnum = AnalysisType.LICENSE_PLATE;
    } else if (result.type === 'QR_CODE') {
      typeEnum = AnalysisType.QR_CODE;
    } else {
      typeEnum = AnalysisType.INVALID;
    }
    
    return {
      type: typeEnum,
      value: result.value || '',
      confidence: result.confidence || 0.5,
    } as AppAnalysisResult;
  } catch (error) {
    console.error('Error analyzing image:', error);
    // Return INVALID type instead of throwing to provide better UX
    return {
      type: AnalysisType.INVALID,
      value: '',
      confidence: 0.0,
    };
  }
}





