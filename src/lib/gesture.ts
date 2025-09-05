// V-gesture detection utilities
import { GesturePoint, GesturePattern } from '@/types';

export class VGestureDetector {
  private points: GesturePoint[] = [];
  private isTracking = false;
  private minPoints = 8; // Minimum points for valid gesture
  private maxPoints = 50; // Maximum points to consider
  private timeoutMs = 2000; // Maximum time for gesture completion
  private vAngleThreshold = 45; // Degrees for V-shape detection
  private minDistance = 50; // Minimum distance for valid gesture

  public startTracking(): void {
    this.points = [];
    this.isTracking = true;
  }

  public stopTracking(): void {
    this.isTracking = false;
  }

  public addPoint(x: number, y: number): void {
    if (!this.isTracking) return;

    const point: GesturePoint = {
      x,
      y,
      timestamp: Date.now()
    };

    this.points.push(point);

    // Remove old points
    const now = Date.now();
    this.points = this.points.filter(p => now - p.timestamp < this.timeoutMs);

    // Limit points array size
    if (this.points.length > this.maxPoints) {
      this.points = this.points.slice(-this.maxPoints);
    }
  }

  public detectVGesture(): GesturePattern {
    if (this.points.length < this.minPoints) {
      return {
        points: [...this.points],
        isValid: false,
        confidence: 0
      };
    }

    const pattern = this.analyzeVPattern();
    return {
      points: [...this.points],
      isValid: pattern.isValid,
      confidence: pattern.confidence
    };
  }

  private analyzeVPattern(): { isValid: boolean; confidence: number } {
    // Smooth the points to reduce noise
    const smoothedPoints = this.smoothPoints(this.points);
    
    if (smoothedPoints.length < this.minPoints) {
      return { isValid: false, confidence: 0 };
    }

    // Find the turning point (bottom of the V)
    const turningPoint = this.findTurningPoint(smoothedPoints);
    
    if (!turningPoint) {
      return { isValid: false, confidence: 0 };
    }

    // Split points into left and right segments
    const leftSegment = smoothedPoints.slice(0, turningPoint.index + 1);
    const rightSegment = smoothedPoints.slice(turningPoint.index);

    // Analyze each segment
    const leftAnalysis = this.analyzeSegment(leftSegment, 'left');
    const rightAnalysis = this.analyzeSegment(rightSegment, 'right');

    // Check if both segments form valid lines
    if (!leftAnalysis.isValidLine || !rightAnalysis.isValidLine) {
      return { isValid: false, confidence: 0 };
    }

    // Calculate angle between the two segments
    const angle = this.calculateAngleBetweenSegments(leftAnalysis.slope, rightAnalysis.slope);
    
    // Check if angle forms a valid V shape
    const isValidAngle = angle >= this.vAngleThreshold && angle <= 180 - this.vAngleThreshold;
    
    if (!isValidAngle) {
      return { isValid: false, confidence: 0 };
    }

    // Calculate confidence based on multiple factors
    const confidence = this.calculateConfidence(
      leftAnalysis,
      rightAnalysis,
      angle,
      smoothedPoints.length
    );

    return {
      isValid: confidence > 0.7, // 70% confidence threshold
      confidence
    };
  }

  private smoothPoints(points: GesturePoint[]): GesturePoint[] {
    if (points.length < 3) return points;

    const smoothed: GesturePoint[] = [points[0]]; // Keep first point

    for (let i = 1; i < points.length - 1; i++) {
      const prev = points[i - 1];
      const current = points[i];
      const next = points[i + 1];

      // Simple moving average smoothing
      smoothed.push({
        x: (prev.x + current.x + next.x) / 3,
        y: (prev.y + current.y + next.y) / 3,
        timestamp: current.timestamp
      });
    }

    smoothed.push(points[points.length - 1]); // Keep last point
    return smoothed;
  }

  private findTurningPoint(points: GesturePoint[]): { index: number; point: GesturePoint } | null {
    if (points.length < 3) return null;

    let maxY = -Infinity;
    let turningIndex = -1;

    // Find the point with maximum Y (bottom of V)
    for (let i = 1; i < points.length - 1; i++) {
      if (points[i].y > maxY) {
        maxY = points[i].y;
        turningIndex = i;
      }
    }

    if (turningIndex === -1) return null;

    return {
      index: turningIndex,
      point: points[turningIndex]
    };
  }

  private analyzeSegment(points: GesturePoint[], type: 'left' | 'right'): {
    isValidLine: boolean;
    slope: number;
    linearity: number;
    length: number;
  } {
    if (points.length < 2) {
      return { isValidLine: false, slope: 0, linearity: 0, length: 0 };
    }

    const start = points[0];
    const end = points[points.length - 1];

    // Calculate slope
    const slope = (end.y - start.y) / (end.x - start.x);

    // Calculate total length
    const length = this.calculateDistance(start, end);

    // Check if length meets minimum requirement
    if (length < this.minDistance) {
      return { isValidLine: false, slope, linearity: 0, length };
    }

    // Calculate linearity (how close points are to a straight line)
    const linearity = this.calculateLinearity(points);

    // Check direction validity based on type
    const isValidDirection = type === 'left' ? 
      (start.y > end.y && start.x < end.x) : // Left segment: down-right to up-right
      (start.y > end.y && start.x < end.x);   // Right segment: down-right to up-right

    return {
      isValidLine: isValidDirection && linearity > 0.8, // 80% linearity threshold
      slope,
      linearity,
      length
    };
  }

  private calculateDistance(p1: GesturePoint, p2: GesturePoint): number {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
  }

  private calculateLinearity(points: GesturePoint[]): number {
    if (points.length < 3) return 1;

    const start = points[0];
    const end = points[points.length - 1];
    const totalDistance = this.calculateDistance(start, end);

    if (totalDistance === 0) return 0;

    let deviationSum = 0;

    for (let i = 1; i < points.length - 1; i++) {
      const point = points[i];
      const distanceToLine = this.distanceToLine(start, end, point);
      deviationSum += distanceToLine;
    }

    const avgDeviation = deviationSum / (points.length - 2);
    const linearity = Math.max(0, 1 - (avgDeviation / (totalDistance * 0.1))); // 10% tolerance

    return linearity;
  }

  private distanceToLine(start: GesturePoint, end: GesturePoint, point: GesturePoint): number {
    const A = end.y - start.y;
    const B = start.x - end.x;
    const C = end.x * start.y - start.x * end.y;

    return Math.abs(A * point.x + B * point.y + C) / Math.sqrt(A * A + B * B);
  }

  private calculateAngleBetweenSegments(slope1: number, slope2: number): number {
    const angle1 = Math.atan(slope1) * (180 / Math.PI);
    const angle2 = Math.atan(slope2) * (180 / Math.PI);
    
    let angleDiff = Math.abs(angle1 - angle2);
    
    // Normalize to 0-180 range
    if (angleDiff > 180) {
      angleDiff = 360 - angleDiff;
    }

    return angleDiff;
  }

  private calculateConfidence(
    leftAnalysis: any,
    rightAnalysis: any,
    angle: number,
    pointCount: number
  ): number {
    // Weight different factors
    const linearityWeight = 0.3;
    const angleWeight = 0.4;
    const lengthWeight = 0.2;
    const pointWeight = 0.1;

    // Calculate individual confidence scores
    const linearityScore = (leftAnalysis.linearity + rightAnalysis.linearity) / 2;
    
    const idealAngle = 90; // Perfect V is 90 degrees
    const angleScore = 1 - Math.abs(angle - idealAngle) / 90;
    
    const avgLength = (leftAnalysis.length + rightAnalysis.length) / 2;
    const lengthScore = Math.min(1, avgLength / (this.minDistance * 2));
    
    const pointScore = Math.min(1, pointCount / this.minPoints);

    // Calculate weighted confidence
    const confidence = 
      linearityScore * linearityWeight +
      angleScore * angleWeight +
      lengthScore * lengthWeight +
      pointScore * pointWeight;

    return Math.max(0, Math.min(1, confidence));
  }

  public reset(): void {
    this.points = [];
    this.isTracking = false;
  }
}

// Export singleton instance
export const vGestureDetector = new VGestureDetector();