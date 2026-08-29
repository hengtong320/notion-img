import { Vec2 } from 'cc';
import type { Point2 } from './GameTypes';

export function rotatePoint(point: Point2, degrees: number): Point2 {
    const r = degrees * Math.PI / 180;
    const c = Math.cos(r);
    const s = Math.sin(r);
    return { x: point.x * c - point.y * s, y: point.x * s + point.y * c };
}

export function transformPoint(
    point: Point2,
    origin: Point2,
    rotation: number,
    mirrorX: boolean,
): Point2 {
    const local = { x: mirrorX ? -point.x : point.x, y: point.y };
    const rotated = rotatePoint(local, rotation);
    return { x: rotated.x + origin.x, y: rotated.y + origin.y };
}

export function normalize(point: Point2): Point2 {
    const length = Math.hypot(point.x, point.y) || 1;
    return { x: point.x / length, y: point.y / length };
}

export function distancePointToSegment(p: Point2, a: Point2, b: Point2): number {
    const vx = b.x - a.x;
    const vy = b.y - a.y;
    const wx = p.x - a.x;
    const wy = p.y - a.y;
    const len2 = vx * vx + vy * vy;
    if (len2 <= 0.0001) return Math.hypot(p.x - a.x, p.y - a.y);
    const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / len2));
    const px = a.x + vx * t;
    const py = a.y + vy * t;
    return Math.hypot(p.x - px, p.y - py);
}

export function distancePointToPolyline(p: Point2, points: Point2[]): number {
    let best = Number.POSITIVE_INFINITY;
    for (let i = 0; i < points.length - 1; i += 1) {
        best = Math.min(best, distancePointToSegment(p, points[i], points[i + 1]));
    }
    return best;
}

export function boundsForPolyline(points: Point2[], padding = 0): { minX: number; maxX: number; minY: number; maxY: number } {
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const p of points) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
    }
    return { minX: minX - padding, maxX: maxX + padding, minY: minY - padding, maxY: maxY + padding };
}

export function toVec2(p: Point2): Vec2 {
    return new Vec2(p.x, p.y);
}
