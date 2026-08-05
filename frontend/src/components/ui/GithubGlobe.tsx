'use client';
// The globe on the homepage, drawn from the clusters ASTRA actually runs on.
//
// It used to hardcode four regions — Denmark, India, California, Singapore —
// none of which existed. It now reads /system/topology, so the markers are the
// real deployment: a cluster that is down renders red instead of green, and
// adding or removing a region changes this picture with no code edit.
//
// User cities are illustrative traffic origins, not real sessions; each is
// routed to whichever real cluster is genuinely nearest by great-circle
// distance, so the arcs reflect the actual topology.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, extend, useThree, type Object3DNode } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import ThreeGlobe from 'three-globe';
import { Color, Fog, PointLight, AmbientLight, DirectionalLight } from 'three';

import { getPublicTopology, type PublicCluster } from '../../lib/api';

extend({ ThreeGlobe });

// eslint-disable-next-line @typescript-eslint/no-namespace
declare global {
  namespace JSX {
    interface IntrinsicElements {
      threeGlobe: Object3DNode<ThreeGlobe, typeof ThreeGlobe>;
    }
  }
}

const HEALTHY = '#3f8f6b';   // cluster up
const DOWN    = '#d1495b';   // cluster unreachable
const CITY    = '#8a94a6';   // illustrative traffic origin

// A spread of population centres used only to draw plausible traffic lines.
const CITIES: [number, number][] = [
  [19.07, 72.87], [12.97, 77.59], [52.52, 13.40], [51.51, -0.13],
  [40.71, -74.01], [35.68, 139.69], [-33.87, 151.21], [-23.55, -46.63],
  [3.14, 101.69], [37.77, -122.42], [25.20, 55.27], [-26.20, 28.04],
];

function haversine(a: [number, number], b: [number, number]) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const [lat1, lon1] = a, [lat2, lon2] = b;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

type Placed = PublicCluster & { lat: number; lon: number };

function Globe({ clusters }: { clusters: Placed[] }) {
  const ref = useRef<ThreeGlobe>(null);
  const [countries, setCountries] = useState<any>(null);

  useEffect(() => {
    fetch('/countries.geojson').then((r) => r.json()).then(setCountries)
      .catch(() => setCountries({ features: [] }));
  }, []);

  const { arcs, points } = useMemo(() => {
    const up = clusters.filter((c) => c.healthy);
    // Route each city to its nearest HEALTHY cluster — the same failover the
    // scheduler performs, so a downed region visibly sheds its traffic.
    const routable = up.length ? up : clusters;
    const arcs = routable.length ? CITIES.map((city) => {
      const nearest = routable.reduce((best, c) =>
        haversine(city, [c.lat, c.lon]) < haversine(city, [best.lat, best.lon]) ? c : best);
      return {
        startLat: city[0], startLng: city[1],
        endLat: nearest.lat, endLng: nearest.lon,
        color: nearest.healthy ? HEALTHY : DOWN,
      };
    }) : [];
    const points = [
      ...clusters.map((c) => ({
        lat: c.lat, lng: c.lon, size: 1.0,
        color: c.healthy ? HEALTHY : DOWN,
      })),
      ...CITIES.map(([lat, lng]) => ({ lat, lng, size: 0.42, color: CITY })),
    ];
    return { arcs, points };
  }, [clusters]);

  useEffect(() => {
    const g = ref.current;
    if (!g || !countries) return;
    g.hexPolygonsData(countries.features)
      .hexPolygonResolution(3)
      .hexPolygonMargin(0.62)
      .hexPolygonColor(() => 'rgba(150,160,175,0.55)')
      .showAtmosphere(true)
      .atmosphereColor('#93a5b8')
      .atmosphereAltitude(0.18);
    const mat: any = g.globeMaterial();
    mat.color = new Color('#1c2530');
    mat.emissive = new Color('#1b2733');
    mat.emissiveIntensity = 0.3;
    mat.shininess = 0.8;
  }, [countries]);

  useEffect(() => {
    const g = ref.current;
    if (!g) return;
    g.arcsData(arcs)
      .arcColor((d: any) => d.color)
      .arcAltitude(0.2)
      .arcStroke(0.6)
      .arcDashLength(0.9)
      .arcDashGap(3)
      .arcDashAnimateTime(2000)
      .arcsTransitionDuration(800);
    g.pointsData(points)
      .pointColor((d: any) => d.color)
      .pointAltitude(0.01)
      .pointRadius((d: any) => d.size * 1.4);
  }, [arcs, points]);

  return <threeGlobe ref={ref} />;
}

function Lights() {
  const { scene } = useThree();
  useEffect(() => {
    scene.fog = new Fog(0x1c2530, 400, 2000);
    const amb = new AmbientLight(0xcdd6e0, 1.0);
    const dir = new DirectionalLight(0xffffff, 1.1); dir.position.set(-200, 200, 200);
    const p1 = new PointLight(0xa8b6c4, 0.8); p1.position.set(-200, 300, 200);
    const p2 = new PointLight(0x8fa3b5, 0.7); p2.position.set(200, -200, 200);
    scene.add(amb, dir, p1, p2);
    return () => { scene.remove(amb, dir, p1, p2); };
  }, [scene]);
  return null;
}

export default function GithubGlobe({ className }: { className?: string }) {
  const [clusters, setClusters] = useState<Placed[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = () => getPublicTopology()
      .then((t) => {
        if (cancelled) return;
        setClusters(t.clusters.filter(
          (c): c is Placed => c.lat != null && c.lon != null));
      })
      .catch(() => { /* backend may be starting; globe renders bare */ });
    load();
    const id = setInterval(load, 30_000);   // a stopped cluster turns red on its own
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  return (
    <div className={className}
         style={{ width: '100%', aspectRatio: '1 / 1', maxWidth: 620, margin: '0 auto' }}>
      <Canvas camera={{ position: [0, 0, 320], fov: 50, near: 180, far: 1800 }}>
        <Lights />
        <Globe clusters={clusters} />
        <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={0.55}
                       minPolarAngle={Math.PI / 3.5} maxPolarAngle={Math.PI - Math.PI / 3} />
      </Canvas>
    </div>
  );
}
