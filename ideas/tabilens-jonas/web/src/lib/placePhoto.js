// Finds a photo of a place with Google Places (New) text search, using the same
// browser key as the map. Needs "Places API (New)" enabled on the key's project.
import { loadGoogleMaps } from './loadGoogleMaps.js';

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

export async function findPlacePhoto(query) {
  if (!API_KEY || !query) return null;
  await loadGoogleMaps(API_KEY);
  const { Place } = await google.maps.importLibrary('places');
  const { places } = await Place.searchByText({
    textQuery: query,
    fields: ['displayName', 'photos', 'googleMapsURI'],
    language: 'en',
    region: 'jp',
    maxResultCount: 1,
  });
  const place = places?.[0];
  const photo = place?.photos?.[0];
  if (!photo) return null;
  // Google requires showing the photographer's attribution next to the photo.
  const author = photo.authorAttributions?.[0];
  return {
    url: photo.getURI({ maxWidth: 1280 }),
    caption: place.displayName,
    credit: author?.displayName ?? 'Google Maps',
    creditUrl: author?.uri ?? place.googleMapsURI ?? null,
  };
}
