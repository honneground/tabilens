// Loads the Google Maps JavaScript API once, with no extra npm dependency.
let loading = null;

export function loadGoogleMaps(apiKey) {
  if (window.google?.maps?.importLibrary) return Promise.resolve(window.google.maps);
  if (loading) return loading;

  loading = new Promise((resolve, reject) => {
    const cb = '__tabilensMapsReady';
    window[cb] = () => {
      delete window[cb];
      resolve(window.google.maps);
    };
    const s = document.createElement('script');
    s.src =
      `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}` +
      `&v=weekly&loading=async&language=en&region=JP&callback=${cb}`;
    s.async = true;
    s.onerror = () => {
      loading = null;
      reject(new Error('Google Maps failed to load — check the API key and its allowed referrers.'));
    };
    document.head.appendChild(s);
  });
  return loading;
}
