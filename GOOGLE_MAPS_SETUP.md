# Google Maps API Setup for Family Map Feature

## Overview
The family map feature displays the locations of family members on an interactive Google Map. It uses the Google Maps JavaScript API for the map display and the Google Geocoding API to convert addresses to coordinates.

## Setup Instructions

### 1. Get a Google Maps API Key

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the following APIs:
   - **Maps JavaScript API** (for displaying the map)
   - **Geocoding API** (for converting addresses to coordinates)
4. Go to "Credentials" and create an API key
5. (Optional but recommended) Restrict the API key:
   - For the frontend: Restrict to HTTP referrers (websites) and add your domain
   - For the backend: Restrict to IP addresses and add your server's IP

### 2. Configure Environment Variables

#### Backend (.env file in ancestree-backend/)
```env
GOOGLE_MAPS_API_KEY=your_actual_api_key_here
```
<>
#### Frontend (.env file in ancestree-app/)
```env
VITE_GOOGLE_MAPS_API_KEY=your_actual_api_key_here
```

**Note:** You can use the same API key for both frontend and backend, or create separate keys for better security.

### 3. Features

- **Interactive Map**: Displays all family members with complete addresses
- **Clickable Markers**: Click on map markers to select that person
- **Address Geocoding**: Automatically converts street addresses to map coordinates
- **Location List**: Shows all plotted locations below the map
- **Real-time Updates**: Map updates when address information is added or changed

### 4. Usage

1. Add address information (street, city, zip, country) to family members in the editor
2. Click the "🗺️ Map" tab in the sidebar
3. The map will automatically load and display markers for all people with addresses
4. Click on markers or the location list to select that person
5. Use the "Refresh" button to reload locations after making address changes

### 5. Troubleshooting

**Map not loading:**
- Check that the Google Maps API key is correctly set in both .env files
- Ensure the Maps JavaScript API is enabled in Google Cloud Console
- Check browser console for any API key restriction errors

**Addresses not showing:**
- Verify that the Geocoding API is enabled
- Check that addresses are complete (at least street and city)
- Look at the network tab to see if geocoding requests are failing

**API Quota Issues:**
- Google Maps APIs have usage quotas and billing requirements
- Monitor your usage in the Google Cloud Console
- Consider implementing caching for frequently accessed addresses

### 6. Cost Considerations

Google Maps APIs have usage-based pricing:
- Maps JavaScript API: ~$7 per 1,000 loads
- Geocoding API: ~$5 per 1,000 requests

For small family trees, the free tier should be sufficient. For larger deployments, consider:
- Implementing address caching in the database
- Adding rate limiting
- Using API key restrictions for security

### 7. Security Best Practices

- Use separate API keys for frontend and backend
- Implement proper API key restrictions (HTTP referrers for frontend, IP addresses for backend)
- Don't commit API keys to version control
- Regularly rotate API keys
- Monitor API usage for unusual activity
