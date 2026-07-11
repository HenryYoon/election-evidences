import { useEffect, useMemo, useRef, useState } from 'react';
import Map, { Source, Layer, Marker, type MapRef } from 'react-map-gl/maplibre';
import type { GeoCollection } from '../../lib/data';
import { makeBaseStyle, bboxOfCollection, densityColor } from '../../lib/geo';

const BASE_STYLE = makeBaseStyle();

interface Props {
  geo: GeoCollection;      // count 주입된 컬렉션
  onPick: (slug: string) => void;
  pickable?: (slug: string) => boolean; // 드릴다운 가능한 지역
  fitOnlyCounted?: boolean; // 증거 있는 지역으로만 화면 맞춤(원거리 섬 제외)
}

export default function RegionExplorer({ geo, onPick, pickable, fitOnlyCounted }: Props) {
  const ref = useRef<MapRef | null>(null);
  const [hover, setHover] = useState<string | null>(null);

  const max = useMemo(
    () => Math.max(1, ...geo.features.map((f) => f.properties.count || 0)),
    [geo]
  );

  const enriched = useMemo<GeoCollection>(
    () => ({
      type: 'FeatureCollection',
      features: geo.features.map((f) => ({
        ...f,
        properties: {
          ...f.properties,
          fillColor: densityColor(f.properties.count || 0, max),
        },
      })),
    }),
    [geo, max]
  );

  const bbox = useMemo(() => {
    const counted = geo.features.some((f) => (f.properties.count || 0) > 0);
    return bboxOfCollection(
      geo,
      fitOnlyCounted && counted ? (f) => (f.properties.count || 0) > 0 : undefined
    );
  }, [geo, fitOnlyCounted]);

  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const m = ref.current?.getMap();
    if (!m || !loaded || !isFinite(bbox[0])) return;
    m.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], { padding: 60, duration: 0 });
  }, [bbox, loaded]);

  return (
    <Map
      ref={ref}
      mapStyle={BASE_STYLE}
      initialViewState={{ longitude: 127.8, latitude: 36.2, zoom: 6 }}
      onLoad={() => setLoaded(true)}
      interactiveLayerIds={['region-fill']}
      cursor={hover ? 'pointer' : 'default'}
      onMouseMove={(e) => {
        const f = e.features?.[0];
        setHover(f ? (f.properties as any).slug : null);
      }}
      onMouseLeave={() => setHover(null)}
      onClick={(e) => {
        const f = e.features?.[0];
        if (f) {
          const slug = (f.properties as any).slug;
          if (!pickable || pickable(slug)) onPick(slug);
        }
      }}
      dragRotate={false}
      touchZoomRotate={false}
    >
      <Source id="regions" type="geojson" data={enriched as any}>
        <Layer id="region-fill" type="fill"
          paint={{ 'fill-color': ['get', 'fillColor'], 'fill-opacity': 0.62 }} />
        <Layer id="region-line" type="line"
          paint={{
            'line-color': '#ffffff',
            'line-width': ['case', ['==', ['get', 'slug'], hover ?? ''], 3, 1.2],
          }} />
      </Source>

      {geo.features.map((f) => {
        const cnt = f.properties.count || 0;
        const can = !pickable || pickable(f.properties.slug);
        return (
          <Marker key={f.properties.slug} longitude={f.properties.center[0]} latitude={f.properties.center[1]}>
            <button
              onClick={(ev) => { ev.stopPropagation(); if (can) onPick(f.properties.slug); }}
              style={{
                border: 0, background: 'transparent', color: '#fff', textAlign: 'center',
                lineHeight: 1.15, cursor: can ? 'pointer' : 'default', pointerEvents: cnt || can ? 'auto' : 'none',
                textShadow: '0 1px 3px rgba(0,0,0,.45)', opacity: can ? 1 : 0.75,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700 }}>{f.properties.name}</div>
              <div style={{ fontSize: 15, fontWeight: 800 }}>{cnt > 0 ? cnt : ''}</div>
            </button>
          </Marker>
        );
      })}
    </Map>
  );
}
