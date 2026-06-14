import { createElement, useEffect } from 'react';
import { Image, Platform, View } from 'react-native';
import { colors } from '../theme';

const KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY || '';

type Props = {
  lat: number; // base/center (village) — changing it recenters & resets the pin
  lng: number;
  label?: string;
  height?: number;
  onChange?: (lat: number, lng: number) => void; // fired when the farmer drags/taps
};

/**
 * Interactive farm-location map with a DRAGGABLE pin (Google Maps JS API, web).
 * The farmer picks a village (which sets the center), then drags the pin — or taps
 * the map — to their exact plot; the chosen lat/lng is reported via onChange.
 *
 * Implemented as an isolated iframe (srcDoc) that loads Maps JS and posts the
 * dragged coordinates back to the app via window.postMessage. On native (or with
 * no key) it falls back to a static map image.
 */
function buildSrcDoc(lat: number, lng: number, label: string): string {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">
<style>html,body,#map{height:100%;width:100%;margin:0;padding:0}</style></head>
<body><div id="map"></div>
<script>
  function initMap(){
    var c={lat:${lat},lng:${lng}};
    var map=new google.maps.Map(document.getElementById('map'),{center:c,zoom:14,streetViewControl:false,mapTypeControl:false,fullscreenControl:false});
    var marker=new google.maps.Marker({position:c,map:map,draggable:true,title:${JSON.stringify(label)},animation:google.maps.Animation.DROP});
    function send(p){parent.postMessage(JSON.stringify({type:'fs-map',lat:p.lat(),lng:p.lng()}),'*');}
    marker.addListener('dragend',function(e){send(e.latLng);});
    map.addListener('click',function(e){marker.setPosition(e.latLng);send(e.latLng);});
  }
  window.gm_authFailure=function(){document.body.innerHTML='<div style="font:14px sans-serif;padding:12px;color:#b45309">Map key error — check the Google Maps API key.</div>';};
</script>
<script src="https://maps.googleapis.com/maps/api/js?key=${KEY}&callback=initMap" async defer></script>
</body></html>`;
}

export function MapPicker({ lat, lng, label = '', height = 220, onChange }: Props) {
  // Listen for coordinates posted back from the map iframe (web only).
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const handler = (ev: MessageEvent) => {
      try {
        const d = JSON.parse(ev.data);
        if (d && d.type === 'fs-map' && typeof d.lat === 'number' && onChange) onChange(d.lat, d.lng);
      } catch {
        // ignore non-JSON messages
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onChange]);

  if (Platform.OS === 'web' && KEY) {
    return createElement('iframe', {
      // Remount (recenter + reset pin) when the base village coords change.
      key: `${lat.toFixed(4)},${lng.toFixed(4)}`,
      srcDoc: buildSrcDoc(lat, lng, label),
      title: 'farm-location-map',
      style: { border: 0, width: '100%', height, borderRadius: 14, display: 'block' },
    });
  }

  // Native / no-key fallback: static map image.
  const osm = `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=14&size=600x400&markers=${lat},${lng},red-pushpin`;
  return (
    <View style={{ borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: colors.hairline }}>
      <Image source={{ uri: osm }} style={{ width: '100%', height }} resizeMode="cover" />
    </View>
  );
}
