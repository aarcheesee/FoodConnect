/*
  Nominatim Geocoder (free)
  --------------------------
  Nominatim is OpenStreetMap's free geocoding service.
  We send an address string, it returns lat/lng coordinates.
  Rules from Nominatim:
    - Provide a User-Agent header so they can identify us
    - Don't make more than 1 request per second (we only do one per registration so it's fine)
  If it fails (offline / timeout), we return {0,0} so the app still works
  (demo seed users already have hardcoded Mumbai coordinates anyway).
*/

export async function geocodeAddress(address) {
  if (!address) return { latitude: 0, longitude: 0 };
  try {
    const url =
      'https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' +
      encodeURIComponent(address);
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'FoodConnectStudentProject/v1',
      },
    });
    const data = await resp.json();
    if (data && data.length > 0) {
      return {
        latitude: parseFloat(data[0].lat),
        longitude: parseFloat(data[0].lon),
      };
    }
    return { latitude: 0, longitude: 0 };
  } catch (e) {
    console.warn('Geocoding failed (offline?):', e.message);
    return { latitude: 0, longitude: 0 };
  }
}
