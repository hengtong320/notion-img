export interface Point2 {
    x: number;
    y: number;
}

export type ZoneId = 'dragon' | 'tiger' | 'bird' | 'tortoise';

export interface PieceConfig {
    id: string;
    zone: ZoneId;
    points: Point2[];
    /** 唯一真值：箭头朝向、阻挡射线与飞出动画都读取该向量。 */
    exit: Point2;
    blockers: string[];
    tier: number;
}

export interface ZoneConfig {
    id: ZoneId;
    name: string;
    shortName: string;
    seal: string;
    origin: Point2;
    width: number;
    height: number;
    rotation: number;
    mirrorX: boolean;
    color: string;
    accent: string;
}

export interface LevelConfig {
    id: string;
    no: number;
    title: string;
    subtitle: string;
    totalPieces: number;
    zones: ZoneConfig[];
    pieces: PieceConfig[];
    zoneOrder: ZoneId[];
    solutionOrder: string[];
}
