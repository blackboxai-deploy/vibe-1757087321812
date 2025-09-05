'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { vGestureDetector } from '@/lib/gesture';

interface GestureDetectorProps {
  children: React.ReactNode;
  onVaultActivated: () => void;
}

export function GestureDetector({ children, onVaultActivated }: GestureDetectorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [gesturePoints, setGesturePoints] = useState<Array<{ x: number; y: number }>>([]);
  const [showGestureTrail, setShowGestureTrail] = useState(false);
  const detectionTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const animationTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const clearGestureTrail = useCallback(() => {
    setGesturePoints([]);
    setShowGestureTrail(false);
  }, []);

  const handleGestureStart = useCallback((clientX: number, clientY: number) => {
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    setIsDetecting(true);
    setShowGestureTrail(true);
    setGesturePoints([{ x, y }]);
    
    vGestureDetector.startTracking();
    vGestureDetector.addPoint(x, y);
    
    // Clear any existing timeout
    if (detectionTimeoutRef.current) {
      clearTimeout(detectionTimeoutRef.current);
    }
    
    // Set timeout to stop detection if no movement
    detectionTimeoutRef.current = setTimeout(() => {
      setIsDetecting(false);
      vGestureDetector.stopTracking();
      clearGestureTrail();
    }, 2000);
  }, [clearGestureTrail]);

  const handleGestureMove = useCallback((clientX: number, clientY: number) => {
    if (!isDetecting || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    vGestureDetector.addPoint(x, y);
    setGesturePoints(prev => [...prev.slice(-20), { x, y }]); // Keep last 20 points
    
    // Reset timeout
    if (detectionTimeoutRef.current) {
      clearTimeout(detectionTimeoutRef.current);
    }
    detectionTimeoutRef.current = setTimeout(() => {
      setIsDetecting(false);
      vGestureDetector.stopTracking();
      clearGestureTrail();
    }, 2000);
  }, [isDetecting, clearGestureTrail]);

  const handleGestureEnd = useCallback(() => {
    if (!isDetecting) return;
    
    setIsDetecting(false);
    
    // Analyze the gesture
    const pattern = vGestureDetector.detectVGesture();
    
    if (pattern.isValid && pattern.confidence > 0.7) {
      // V-gesture detected! Show success animation and open vault
      setGesturePoints(prev => prev.map(point => ({ ...point, success: true })) as any);
      
      // Trigger vault activation after brief animation
      animationTimeoutRef.current = setTimeout(() => {
        onVaultActivated();
      }, 800);
    } else {
      // Failed gesture - show error animation
      setGesturePoints(prev => prev.map(point => ({ ...point, error: true })) as any);
    }
    
    vGestureDetector.stopTracking();
    
    // Clear trail after animation
    setTimeout(() => {
      clearGestureTrail();
    }, 1500);
    
    // Clear timeout
    if (detectionTimeoutRef.current) {
      clearTimeout(detectionTimeoutRef.current);
    }
  }, [isDetecting, onVaultActivated, clearGestureTrail]);

  // Mouse events
  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    handleGestureStart(event.clientX, event.clientY);
  }, [handleGestureStart]);

  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    handleGestureMove(event.clientX, event.clientY);
  }, [handleGestureMove]);

  const handleMouseUp = useCallback(() => {
    handleGestureEnd();
  }, [handleGestureEnd]);

  // Touch events
  const handleTouchStart = useCallback((event: React.TouchEvent) => {
    if (event.touches.length === 1) {
      const touch = event.touches[0];
      handleGestureStart(touch.clientX, touch.clientY);
    }
  }, [handleGestureStart]);

  const handleTouchMove = useCallback((event: React.TouchEvent) => {
    if (event.touches.length === 1) {
      event.preventDefault(); // Prevent scrolling
      const touch = event.touches[0];
      handleGestureMove(touch.clientX, touch.clientY);
    }
  }, [handleGestureMove]);

  const handleTouchEnd = useCallback(() => {
    handleGestureEnd();
  }, [handleGestureEnd]);

  useEffect(() => {
    return () => {
      if (detectionTimeoutRef.current) {
        clearTimeout(detectionTimeoutRef.current);
      }
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
      vGestureDetector.reset();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative touch-none select-none"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      {children}
      
      {/* Gesture Trail Overlay */}
      {showGestureTrail && (
        <div className="absolute inset-0 pointer-events-none z-10">
          <svg className="w-full h-full">
            {gesturePoints.length > 1 && (
              <g>
                {/* Trail path */}
                <path
                  d={`M ${gesturePoints.map(point => `${point.x},${point.y}`).join(' L ')}`}
                  stroke={(gesturePoints[0] as any)?.success ? '#10b981' : (gesturePoints[0] as any)?.error ? '#ef4444' : '#3b82f6'}
                  strokeWidth="3"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="animate-pulse"
                />
                
                {/* Trail points */}
                {gesturePoints.map((point, index) => (
                  <circle
                    key={index}
                    cx={point.x}
                    cy={point.y}
                    r={Math.max(2, 6 - index * 0.2)}
                    fill={(point as any).success ? '#10b981' : (point as any).error ? '#ef4444' : '#3b82f6'}
                    className="animate-pulse"
                    style={{
                      opacity: Math.max(0.3, 1 - index * 0.05)
                    }}
                  />
                ))}
                
                {/* Success/Error indicator */}
                {((gesturePoints[0] as any)?.success || (gesturePoints[0] as any)?.error) && (
                  <g>
                    <circle
                      cx={gesturePoints[gesturePoints.length - 1]?.x || 0}
                      cy={gesturePoints[gesturePoints.length - 1]?.y || 0}
                      r="20"
                      fill="none"
                      stroke={(gesturePoints[0] as any)?.success ? '#10b981' : '#ef4444'}
                      strokeWidth="2"
                      className="animate-ping"
                    />
                    <text
                      x={gesturePoints[gesturePoints.length - 1]?.x || 0}
                      y={(gesturePoints[gesturePoints.length - 1]?.y || 0) + 5}
                      textAnchor="middle"
                      className="text-sm font-bold"
                      fill={(gesturePoints[0] as any)?.success ? '#10b981' : '#ef4444'}
                    >
                      {(gesturePoints[0] as any)?.success ? '✓' : '✗'}
                    </text>
                  </g>
                )}
              </g>
            )}
          </svg>
        </div>
      )}
      
      {/* Detection indicator */}
      {isDetecting && (
        <div className="absolute top-4 right-4 z-20">
          <div className="bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-medium animate-pulse">
            Draw V-shape...
          </div>
        </div>
      )}
    </div>
  );
}