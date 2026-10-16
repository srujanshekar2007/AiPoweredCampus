'use client';

import dynamic from 'next/dynamic';
import { TwinUIOverlay } from '@/components/twin/TwinUIOverlay';
import { useTwinData } from '@/hooks/useTwinData';

// Three.js needs the browser, so the canvas is never rendered on the server.
const CampusScene = dynamic(() => import('@/components/twin/CampusScene'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-slate-100 text-sm text-slate-500">
      Preparing 3D scene…
    </div>
  ),
});

export default function DigitalTwinPage() {
  // Loads buildings / floors / rooms / issues into the Zustand store and
  // subscribes to realtime changes so markers update live.
  useTwinData();

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-slate-100">
      <CampusScene className="absolute inset-0" />
      <TwinUIOverlay />
    </main>
  );
}
