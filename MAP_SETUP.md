# Google Maps API Setup for Family Map Feature

## Overview
The family map feature displays the locations of family members on an interactive Google Map. It uses the **Google Maps JavaScript API** for map display only. Address geocoding (converting addresses to coordinates) is now handled by **Photon** (Komoot's free geocoding service based on OpenStreetMap data), eliminating the need for the Google Geocoding API.

## Setup Instructions

### 1. Get a Google Maps API Key

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the following API:
   - **Maps JavaScript API** (for displaying the map)
   - ~~**Geocoding API**~~ (No longer needed - we use Photon instead)
4. Go to "Credentials" and create an API key
5. (Optional but recommended) Restrict the API key:
   - For the frontend: Restrict to HTTP referrers (websites) and add your domain

### 2. Configure Environment Variables

#### ~~Backend (.env file in ancestree-backend/)~~
~~Backend no longer needs Google Maps API key as geocoding is client-side~~

#### Frontend (.env file in ancestree-app/)
\`\`\`env
VITE_GOOGLE_MAPS_API_KEY=your_actual_api_key_here
\`\`\`

**Note:** Only the frontend needs the Google Maps API key for map display.

### 3. Geocoding Service (Photon by Komoot)

**What is Photon?**
- Free, open-source geocoding service based on OpenStreetMap data
- No API key required
- Rate limit: 10 requests per second (automatically handled)
- Public instance: https://photon.komoot.io/

**How it works:**
- When nodes are loaded, the system checks if addresses have changed
- Changed addresses are queued for geocoding in the background
- Geocoding respects the 10 req/sec rate limit
- Coordinates are encrypted and stored in the database
- Map updates dynamically as geocoding completes

**Address Hash Verification:**
- Each address (city|zip|country) has an MD5 hash
- On every node load, the system compares current hash with stored hash
- If hashes differ, the address is re-geocoded automatically
- This ensures coordinates stay in sync with address changes

### 4. Features

- **Interactive Map**: Displays all family members with geocoded coordinates
- **Clickable Markers**: Click on map markers to select that person
- **Automatic Geocoding**: Background geocoding when addresses change
- **Smart Caching**: Only re-geocodes when addresses actually change
- **Location List**: Shows all plotted locations below the map
- **Real-time Updates**: Map updates dynamically as geocoding completes
- **Batch Operation Awareness**: Pauses geocoding during encryption/decryption

### 5. Usage

1. Add address information (city, zip, country) to family members in the editor
2. Click the "🗺️ Map" tab in the sidebar
3. The system automatically geocodes addresses in the background (no action needed)
4. The map displays markers for all people with valid coordinates
5. Click on markers or the location list to select that person
6. Address changes trigger automatic re-geocoding

### 6. Troubleshooting

**Map not loading:**
- Check that the Google Maps API key is correctly set in .env file
- Ensure the Maps JavaScript API is enabled in Google Cloud Console
- Check browser console for any API key restriction errors

**Addresses not geocoding:**
- Check browser console for geocoding errors
- Verify addresses are reasonably complete (at least city)
- Photon uses OpenStreetMap data, which may differ from Google Maps
- Consider adding more specific address information

**Geocoding taking too long:**
- Geocoding runs at 10 requests/second maximum
- For many nodes, this may take time (shows progress in console)
- Geocoding runs in background and doesn't block the UI

### 7. Cost Considerations

**Google Maps:**
- Maps JavaScript API: ~$7 per 1,000 map loads
- Free tier: $200 credit per month (covers ~28,500 map loads)
- ~~Geocoding API: No longer used~~

**Photon Geocoding:**
- Completely free
- No API key required
- Runs on Komoot's public infrastructure
- Please respect the 10 req/sec rate limit (automatically enforced)

For typical family trees, the Google Maps free tier should be sufficient for map display.

### 8. Security Best Practices

- Use HTTP referrer restrictions for your Google Maps API key
- Don't commit API keys to version control
- Monitor API usage for unusual activity
- No backend API key needed anymore (geocoding is client-side)
