<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Petty Patrol

A mobile web app for reporting bad drivers and claiming partner deals. Built with React, TypeScript, and Vite.

View your app in AI Studio: https://ai.studio/apps/drive/1QKyWnms5DzrsGFDFYiNsJ9iqUyLB2pFL

## Run Locally

**Prerequisites:** Node.js 18+


1. Install dependencies:
   ```bash
   npm install
   ```

2. Set environment variables:
   - **For local development**: Create `.env.local` file in the `pettypatrol` directory:
     ```
     GEMINI_API_KEY=your_gemini_api_key_here
     GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
     VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
     VITE_POSTHOG_KEY=your_posthog_key_here (optional)
     VITE_POSTHOG_HOST=https://us.i.posthog.com (optional)
     ```
   - Get your Gemini API key from: https://makersuite.google.com/app/apikey
   - Get your Google Maps API key from: https://console.cloud.google.com/google/maps-apis
     - Enable **Maps JavaScript API** (for the map display)
     - Enable **Geocoding API** (for reverse geocoding - coordinates to addresses)
     - **Important**: Restrict the API key to your domain for security
   - Get your PostHog key from: https://posthog.com (optional, for analytics)

3. Run the app:
   ```bash
   npm run dev
   ```

## Deploy to Vercel

1. **Build the project:**
   ```bash
   npm run build
   ```

2. **Set environment variables in Vercel:**
   - Go to your Vercel project Settings → Environment Variables
   - Add the following:
     - `GEMINI_API_KEY` (required)
     - `GOOGLE_MAPS_API_KEY` (required for server-side geocoding API)
     - `VITE_GOOGLE_MAPS_API_KEY` (required for client-side Maps JavaScript API)
     - `VITE_POSTHOG_KEY` (optional)
     - `VITE_POSTHOG_HOST` (optional, defaults to `https://us.i.posthog.com`)

3. **Deploy:**
   - Push to your connected Git repository, or
   - Use Vercel CLI: `vercel --prod`

## Features

- 📸 Image analysis using Google Gemini AI
- 🗺️ Location tracking and mapping
- 🏆 Badge system and gamification
- 🎁 Partner deals via QR codes
- 📱 Progressive Web App (PWA) support
- 💾 Local data persistence
- 📊 Analytics integration (PostHog)

## Project Structure

```
pettypatrol/
├── api/              # Vercel serverless functions
├── components/       # React components
├── services/         # API services and utilities
├── public/           # Static assets and PWA files
└── dist/             # Build output
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes | Google Gemini API key for image analysis |
| `GOOGLE_MAPS_API_KEY` | Yes | Google Maps API key for server-side reverse geocoding (coordinates to addresses) |
| `VITE_GOOGLE_MAPS_API_KEY` | Yes | Google Maps API key for client-side Maps JavaScript API (map display) |
| `VITE_POSTHOG_KEY` | No | PostHog project API key for analytics |
| `VITE_POSTHOG_HOST` | No | PostHog API host (default: https://us.i.posthog.com) |

**Note**: You can use the same Google Maps API key for both `GOOGLE_MAPS_API_KEY` and `VITE_GOOGLE_MAPS_API_KEY`. Make sure to enable both **Maps JavaScript API** and **Geocoding API** in Google Cloud Console, and restrict the key to your domain for security.

## Beta Launch Checklist

Before deploying to production, ensure:

- ✅ Environment variables are configured
- ✅ API endpoints have proper error handling
- ✅ Data persistence is working (localStorage)
- ✅ Error boundaries are in place
- ✅ Analytics tracking is configured
- ✅ PWA manifest and service worker are working
- ✅ Test on real mobile devices (iOS and Android)
- ✅ Test offline functionality
