'use client';
// 3D card — tilts toward the mouse on hover. Aceternity-style.

import { useRef, useState, useEffect } from 'react';
import { cn } from '../../lib/utils';

export default function ThreeDCard({
  children, className, intensity = 12,
}: {
  children:   React.ReactNode;
  className?: string;
  intensity?: number;  // degrees of tilt at the corner
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState('rotateX(0deg) rotateY(0deg)');

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width  - 0.5) * 2;   // -1..1
      const y = ((e.clientY - r.top)  / r.height - 0.5) * 2;
      setTransform(
        `rotateX(${-y * intensity}deg) rotateY(${x * intensity}deg) scale3d(1.02, 1.02, 1.02)`,
      );
    };
    const onLeave = () => setTransform('rotateX(0deg) rotateY(0deg) scale3d(1,1,1)');

    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
    return () => {
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', onLeave);
    };
  }, [intensity]);

  return (
    <div
      ref={ref}
      className={cn('transition-transform duration-150 ease-out', className)}
      style={{ transform, transformStyle: 'preserve-3d' }}
    >
      {children}
    </div>
  );
}
