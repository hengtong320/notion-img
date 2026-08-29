import type { LevelConfig, PieceConfig, Point2, ZoneConfig, ZoneId } from './GameTypes';
import { normalize, rotatePoint, transformPoint } from './Geometry';

interface TemplatePiece {
    key: string;
    points: Point2[];
    exit: Point2;
    blockers: string[];
    tier: number;
}

/**
 * 单个象限的十八笔锁纹。
 * 每一层的箭头出口都被外一层的真实线段遮挡，视觉与规则一致。
 */
const TEMPLATE: TemplatePiece[] = [
    // 四根外框：初始合法动作。
    { key: 'oR', tier: 0, blockers: [], exit: { x: 0, y: 1 }, points: [
        { x: 112, y: -96 }, { x: 112, y: 96 },
    ] },
    { key: 'oT', tier: 0, blockers: [], exit: { x: -1, y: 0 }, points: [
        { x: 96, y: 112 }, { x: -96, y: 112 },
    ] },
    { key: 'oL', tier: 0, blockers: [], exit: { x: 0, y: -1 }, points: [
        { x: -112, y: 96 }, { x: -112, y: -96 },
    ] },
    { key: 'oB', tier: 0, blockers: [], exit: { x: 1, y: 0 }, points: [
        { x: -96, y: -112 }, { x: 96, y: -112 },
    ] },

    // 第二层：出口射线分别穿过对应外框。
    { key: 'mR', tier: 1, blockers: ['oR'], exit: { x: 1, y: 0 }, points: [
        { x: 34, y: 70 }, { x: 78, y: 70 }, { x: 78, y: -42 }, { x: 92, y: -42 }, { x: 92, y: 48 }, { x: 100, y: 48 },
    ] },
    { key: 'mT', tier: 1, blockers: ['oT'], exit: { x: 0, y: 1 }, points: [
        { x: -70, y: 34 }, { x: -70, y: 78 }, { x: 42, y: 78 }, { x: 42, y: 92 }, { x: -48, y: 92 }, { x: -48, y: 100 },
    ] },
    { key: 'mL', tier: 1, blockers: ['oL'], exit: { x: -1, y: 0 }, points: [
        { x: -34, y: -70 }, { x: -78, y: -70 }, { x: -78, y: 42 }, { x: -92, y: 42 }, { x: -92, y: -48 }, { x: -100, y: -48 },
    ] },
    { key: 'mB', tier: 1, blockers: ['oB'], exit: { x: 0, y: -1 }, points: [
        { x: 70, y: -34 }, { x: 70, y: -78 }, { x: -42, y: -78 }, { x: -42, y: -92 }, { x: 48, y: -92 }, { x: 48, y: -100 },
    ] },

    // 第三层：被第二层的竖/横段遮挡。
    { key: 'iR', tier: 2, blockers: ['mR'], exit: { x: 1, y: 0 }, points: [
        { x: 8, y: 52 }, { x: 52, y: 52 }, { x: 52, y: -20 }, { x: 66, y: -20 }, { x: 66, y: 20 }, { x: 74, y: 20 },
    ] },
    { key: 'iT', tier: 2, blockers: ['mT'], exit: { x: 0, y: 1 }, points: [
        { x: -52, y: 8 }, { x: -52, y: 52 }, { x: 20, y: 52 }, { x: 20, y: 66 }, { x: -20, y: 66 }, { x: -20, y: 74 },
    ] },
    { key: 'iL', tier: 2, blockers: ['mL'], exit: { x: -1, y: 0 }, points: [
        { x: -8, y: -52 }, { x: -52, y: -52 }, { x: -52, y: 20 }, { x: -66, y: 20 }, { x: -66, y: -20 }, { x: -74, y: -20 },
    ] },
    { key: 'iB', tier: 2, blockers: ['mB'], exit: { x: 0, y: -1 }, points: [
        { x: 52, y: -8 }, { x: 52, y: -52 }, { x: -20, y: -52 }, { x: -20, y: -66 }, { x: 20, y: -66 }, { x: 20, y: -74 },
    ] },

    // 内钩：出口正前方分别是第三层的横/竖段。
    { key: 'cR', tier: 3, blockers: ['iR'], exit: { x: 1, y: 0 }, points: [
        { x: -28, y: 31 }, { x: 20, y: 31 }, { x: 20, y: 0 }, { x: 46, y: 0 },
    ] },
    { key: 'cT', tier: 3, blockers: ['iT'], exit: { x: 0, y: 1 }, points: [
        { x: -31, y: -28 }, { x: -31, y: 20 }, { x: 0, y: 20 }, { x: 0, y: 46 },
    ] },
    { key: 'cL', tier: 3, blockers: ['iL'], exit: { x: -1, y: 0 }, points: [
        { x: 28, y: -31 }, { x: -20, y: -31 }, { x: -20, y: 0 }, { x: -46, y: 0 },
    ] },
    { key: 'cB', tier: 3, blockers: ['iB'], exit: { x: 0, y: -1 }, points: [
        { x: 31, y: 28 }, { x: 31, y: -20 }, { x: 0, y: -20 }, { x: 0, y: -46 },
    ] },

    // 阵心两笔。
    { key: 'sH', tier: 4, blockers: ['cR'], exit: { x: 1, y: 0 }, points: [
        { x: -18, y: 8 }, { x: 18, y: 8 },
    ] },
    { key: 'sV', tier: 4, blockers: ['cB'], exit: { x: 0, y: -1 }, points: [
        { x: 0, y: 18 }, { x: 0, y: -18 },
    ] },
];

const ZONES: ZoneConfig[] = [
    {
        id: 'dragon', name: '东方青龙', shortName: '青龙', seal: '青',
        origin: { x: -188, y: 226 }, width: 282, height: 282,
        rotation: 0, mirrorX: false, color: '#62b98a', accent: '#c1f0d3',
    },
    {
        id: 'tiger', name: '西方白虎', shortName: '白虎', seal: '白',
        origin: { x: 188, y: 226 }, width: 282, height: 282,
        rotation: 90, mirrorX: true, color: '#ddd3b7', accent: '#fff0c2',
    },
    {
        id: 'bird', name: '南方朱雀', shortName: '朱雀', seal: '朱',
        origin: { x: -188, y: -202 }, width: 282, height: 282,
        rotation: -90, mirrorX: false, color: '#e85b45', accent: '#ffca7b',
    },
    {
        id: 'tortoise', name: '北方玄武', shortName: '玄武', seal: '玄',
        origin: { x: 188, y: -202 }, width: 282, height: 282,
        rotation: 180, mirrorX: true, color: '#6f96cc', accent: '#b7dcff',
    },
];

function makeZonePieces(zone: ZoneConfig): PieceConfig[] {
    const prefix = zone.id;
    return TEMPLATE.map((piece) => {
        const points = piece.points.map((p) => transformPoint(p, zone.origin, zone.rotation, zone.mirrorX));
        let exitLocal = { x: zone.mirrorX ? -piece.exit.x : piece.exit.x, y: piece.exit.y };
        exitLocal = rotatePoint(exitLocal, zone.rotation);
        return {
            id: `${prefix}-${piece.key}`,
            zone: zone.id,
            points,
            exit: normalize(exitLocal),
            blockers: piece.blockers.map((id) => `${prefix}-${id}`),
            tier: piece.tier,
        };
    });
}

const TEMPLATE_ORDER = [
    'oR', 'oT', 'oL', 'oB',
    'mR', 'mT', 'mL', 'mB',
    'iR', 'iT', 'iL', 'iB',
    'cR', 'cT', 'cL', 'cB',
    'sH', 'sV',
];

export function createMainLevel(): LevelConfig {
    const pieces = ZONES.flatMap(makeZonePieces);
    const zoneOrder = ['dragon', 'tiger', 'bird', 'tortoise'] as ZoneId[];
    const solutionOrder = zoneOrder.flatMap((zone) => TEMPLATE_ORDER.map((key) => `${zone}-${key}`));
    return {
        id: 'four-symbols-vertical-slice',
        no: 135,
        title: '四象归真',
        subtitle: '解四方锁纹 · 归玄金吉印',
        totalPieces: pieces.length,
        zones: ZONES,
        pieces,
        zoneOrder,
        solutionOrder,
    };
}

export const TEMPLATE_SOLUTION_ORDER = TEMPLATE_ORDER;
