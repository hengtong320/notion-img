import {
    Color,
    Graphics,
    Label,
    LabelOutline,
    Node,
    UITransform,
    Vec3,
} from 'cc';
import type { Point2, ZoneConfig } from '../core/GameTypes';

export function color(hex: string, alpha = 255): Color {
    const value = new Color();
    value.fromHEX(hex);
    value.a = alpha;
    return value;
}

export function makeNode(
    parent: Node,
    name: string,
    x = 0,
    y = 0,
    width = 10,
    height = 10,
): Node {
    const node = new Node(name);
    node.layer = 1 << 25;
    node.parent = parent;
    node.setPosition(x, y, 0);
    node.addComponent(UITransform).setContentSize(width, height);
    return node;
}

export function makeGraphics(parent: Node, name: string, x = 0, y = 0, width = 750, height = 1334): Graphics {
    const node = makeNode(parent, name, x, y, width, height);
    const graphics = node.addComponent(Graphics);
    graphics.lineCap = Graphics.LineCap.ROUND;
    graphics.lineJoin = Graphics.LineJoin.ROUND;
    return graphics;
}

export function makeLabel(
    parent: Node,
    text: string,
    fontSize: number,
    hex: string,
    x: number,
    y: number,
    width: number,
    height: number,
    outline = true,
): Label {
    const node = makeNode(parent, `Label-${text}`, x, y, width, height);
    const label = node.addComponent(Label);
    label.string = text;
    label.fontSize = fontSize;
    label.lineHeight = Math.round(fontSize * 1.24);
    label.color = color(hex);
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    label.verticalAlign = Label.VerticalAlign.CENTER;
    label.overflow = Label.Overflow.SHRINK;
    label.enableWrapText = false;
    if (outline) {
        const line = node.addComponent(LabelOutline);
        line.color = color('#1b0f05', 230);
        line.width = Math.max(1, Math.round(fontSize * 0.055));
    }
    return label;
}

export function drawBackground(graphics: Graphics): void {
    graphics.clear();
    graphics.fillColor = color('#050403');
    graphics.rect(-375, -667, 750, 1334);
    graphics.fill();

    // 纸纹：全部为程序矢量，不依赖位图素材。
    graphics.strokeColor = color('#6b481b', 17);
    graphics.lineWidth = 1;
    for (let y = -640; y <= 640; y += 19) {
        const phase = (Math.floor((y + 640) / 19) % 2) * 7;
        for (let x = -370 + phase; x < 370; x += 28) {
            graphics.moveTo(x, y);
            graphics.quadraticCurveTo(x + 7, y + 5, x + 14, y);
            graphics.quadraticCurveTo(x + 21, y - 5, x + 28, y);
        }
    }
    graphics.stroke();

    graphics.strokeColor = color('#9a6a23', 44);
    graphics.lineWidth = 1.2;
    drawCloud(graphics, -303, 493, 1.0);
    drawCloud(graphics, 246, 480, 0.88);
    drawCloud(graphics, -322, -485, 0.8);
    drawCloud(graphics, 253, -500, 1.05);
    graphics.stroke();

    // 双层玄金边框。
    graphics.strokeColor = color('#8d5d1c', 190);
    graphics.lineWidth = 2.2;
    graphics.roundRect(-366, -657, 732, 1314, 24);
    graphics.stroke();
    graphics.strokeColor = color('#3f290b', 210);
    graphics.lineWidth = 1;
    graphics.roundRect(-356, -647, 712, 1294, 20);
    graphics.stroke();
}

function drawCloud(graphics: Graphics, x: number, y: number, scale: number): void {
    graphics.moveTo(x, y);
    graphics.bezierCurveTo(x + 18 * scale, y + 19 * scale, x + 43 * scale, y + 18 * scale, x + 54 * scale, y + 3 * scale);
    graphics.bezierCurveTo(x + 72 * scale, y + 18 * scale, x + 104 * scale, y + 11 * scale, x + 112 * scale, y - 8 * scale);
    graphics.bezierCurveTo(x + 92 * scale, y - 19 * scale, x + 53 * scale, y - 16 * scale, x + 38 * scale, y - 4 * scale);
    graphics.bezierCurveTo(x + 23 * scale, y - 13 * scale, x + 6 * scale, y - 9 * scale, x, y);
}

export function drawHeaderDecoration(graphics: Graphics): void {
    graphics.clear();
    graphics.strokeColor = color('#9b6a24', 180);
    graphics.lineWidth = 1.5;
    graphics.moveTo(-175, 536);
    graphics.lineTo(-64, 536);
    graphics.lineTo(-48, 548);
    graphics.lineTo(-32, 536);
    graphics.lineTo(32, 536);
    graphics.lineTo(48, 548);
    graphics.lineTo(64, 536);
    graphics.lineTo(175, 536);
    graphics.stroke();
}

export function drawCircularButton(graphics: Graphics, radius: number, icon: 'back' | 'reset' | 'hint' | 'undo' | 'focus' | 'clear' | 'settings'): void {
    graphics.clear();
    graphics.fillColor = color('#0a0806', 245);
    graphics.strokeColor = color('#b57e28');
    graphics.lineWidth = 3;
    graphics.circle(0, 0, radius);
    graphics.fill();
    graphics.stroke();

    graphics.strokeColor = color('#f0c463');
    graphics.fillColor = color('#f0c463');
    graphics.lineWidth = 5;
    if (icon === 'back') {
        graphics.moveTo(10, 17); graphics.lineTo(-9, 0); graphics.lineTo(10, -17); graphics.stroke();
    } else if (icon === 'reset' || icon === 'undo') {
        graphics.arc(1, 0, 15, -0.65, Math.PI * 1.55, false); graphics.stroke();
        graphics.moveTo(-14, 10); graphics.lineTo(-17, -3); graphics.lineTo(-4, 1); graphics.fill();
    } else if (icon === 'hint') {
        graphics.circle(0, 7, 11); graphics.stroke();
        graphics.moveTo(-5, -6); graphics.lineTo(5, -6); graphics.moveTo(-3, -12); graphics.lineTo(3, -12); graphics.stroke();
        for (let i = 0; i < 6; i += 1) {
            const a = i * Math.PI / 3;
            graphics.moveTo(Math.cos(a) * 17, 7 + Math.sin(a) * 17);
            graphics.lineTo(Math.cos(a) * 22, 7 + Math.sin(a) * 22);
        }
        graphics.stroke();
    } else if (icon === 'focus') {
        graphics.circle(0, 0, 12); graphics.stroke();
        graphics.moveTo(-22, 0); graphics.lineTo(-14, 0); graphics.moveTo(14, 0); graphics.lineTo(22, 0);
        graphics.moveTo(0, -22); graphics.lineTo(0, -14); graphics.moveTo(0, 14); graphics.lineTo(0, 22); graphics.stroke();
    } else if (icon === 'clear') {
        graphics.moveTo(-13, 12); graphics.lineTo(8, -9); graphics.lineTo(16, -1); graphics.lineTo(-5, 20); graphics.close(); graphics.fill();
        graphics.moveTo(1, -15); graphics.lineTo(18, -15); graphics.stroke();
    } else if (icon === 'settings') {
        graphics.circle(0, 0, 7); graphics.stroke();
        for (let i = 0; i < 8; i += 1) {
            const a = i * Math.PI / 4;
            graphics.moveTo(Math.cos(a) * 13, Math.sin(a) * 13);
            graphics.lineTo(Math.cos(a) * 20, Math.sin(a) * 20);
        }
        graphics.stroke();
    }
}

export function drawZoneFrame(graphics: Graphics, zone: ZoneConfig, active: boolean, done: boolean): void {
    graphics.clear();
    const x = zone.origin.x;
    const y = zone.origin.y;
    const r = 137;
    const corner = 18;
    graphics.fillColor = color('#070604', active ? 222 : 205);
    graphics.strokeColor = color(done ? zone.color : active ? '#c99132' : '#4d3511', active ? 235 : 120);
    graphics.lineWidth = active ? 3.2 : 2;
    graphics.moveTo(x - r + corner, y + r);
    graphics.lineTo(x + r - corner, y + r);
    graphics.lineTo(x + r, y + r - corner);
    graphics.lineTo(x + r, y - r + corner);
    graphics.lineTo(x + r - corner, y - r);
    graphics.lineTo(x - r + corner, y - r);
    graphics.lineTo(x - r, y - r + corner);
    graphics.lineTo(x - r, y + r - corner);
    graphics.close();
    graphics.fill();
    graphics.stroke();

    graphics.strokeColor = color(done ? zone.accent : '#6d4817', active ? 145 : 58);
    graphics.lineWidth = 1.2;
    const inner = r - 9;
    graphics.roundRect(x - inner, y - inner, inner * 2, inner * 2, 12);
    graphics.stroke();
}

export function drawZoneMedallion(graphics: Graphics, zone: ZoneConfig, done: boolean, active: boolean): void {
    graphics.clear();
    const x = zone.origin.x;
    const y = zone.origin.y;
    const radius = 43;
    graphics.fillColor = color('#080604', 245);
    graphics.strokeColor = color(done ? zone.accent : active ? '#c99434' : '#5f4216', done ? 255 : 190);
    graphics.lineWidth = done ? 4 : 2.5;
    graphics.circle(x, y, radius);
    graphics.fill();
    graphics.stroke();
    graphics.strokeColor = color(zone.color, done ? 235 : 82);
    graphics.lineWidth = 1.4;
    graphics.circle(x, y, radius - 8);
    graphics.stroke();

    // 四象简化篆形图腾。
    graphics.strokeColor = color(done ? zone.accent : '#8d6222', done ? 255 : 92);
    graphics.lineWidth = done ? 3.6 : 2.2;
    if (zone.id === 'dragon') {
        graphics.arc(x - 3, y + 2, 20, -1.0, Math.PI * 1.25, false);
        graphics.arc(x + 5, y + 4, 11, 0.2, Math.PI * 1.75, true);
        graphics.moveTo(x + 17, y + 17); graphics.lineTo(x + 29, y + 22); graphics.lineTo(x + 22, y + 9);
    } else if (zone.id === 'tiger') {
        graphics.moveTo(x - 23, y + 17); graphics.lineTo(x - 11, y + 27); graphics.lineTo(x - 4, y + 15);
        graphics.moveTo(x + 23, y + 17); graphics.lineTo(x + 11, y + 27); graphics.lineTo(x + 4, y + 15);
        graphics.arc(x, y - 1, 23, 0.12, Math.PI - 0.12, true);
        graphics.moveTo(x - 12, y + 4); graphics.lineTo(x + 12, y + 4);
        graphics.moveTo(x - 9, y - 7); graphics.lineTo(x + 9, y - 7);
    } else if (zone.id === 'bird') {
        graphics.moveTo(x, y + 26); graphics.bezierCurveTo(x - 7, y + 4, x - 27, y + 5, x - 29, y - 13);
        graphics.moveTo(x, y + 26); graphics.bezierCurveTo(x + 7, y + 4, x + 27, y + 5, x + 29, y - 13);
        graphics.moveTo(x, y + 16); graphics.lineTo(x, y - 25);
        graphics.moveTo(x - 12, y - 16); graphics.lineTo(x, y - 25); graphics.lineTo(x + 12, y - 16);
    } else {
        graphics.arc(x, y, 22, 0, Math.PI * 2, false);
        graphics.arc(x + 4, y + 2, 11, 0.3, Math.PI * 1.7, false);
        graphics.moveTo(x - 22, y); graphics.lineTo(x + 22, y);
        graphics.moveTo(x, y - 22); graphics.lineTo(x, y + 22);
    }
    graphics.stroke();
}

export function drawCentralSeal(graphics: Graphics, ready: boolean): void {
    graphics.clear();
    const y = 8;
    graphics.fillColor = color('#070604', 252);
    graphics.strokeColor = color(ready ? '#f2ce6c' : '#9f6a1f');
    graphics.lineWidth = ready ? 5 : 3;
    graphics.circle(0, y, 80);
    graphics.fill();
    graphics.stroke();

    graphics.strokeColor = color(ready ? '#d9a644' : '#5e3d12', ready ? 240 : 150);
    graphics.lineWidth = 2;
    graphics.circle(0, y, 68);
    graphics.stroke();

    drawTrigrams(graphics, 0, y, 56, ready ? 230 : 92);
    drawYinYang(graphics, 0, y, 25, ready);
}

function drawYinYang(graphics: Graphics, x: number, y: number, radius: number, ready: boolean): void {
    graphics.fillColor = color(ready ? '#d8a33f' : '#6d4817');
    graphics.circle(x, y, radius);
    graphics.fill();
    graphics.fillColor = color('#090705');
    graphics.arc(x, y, radius, -Math.PI / 2, Math.PI / 2, false);
    graphics.fill();
    graphics.fillColor = color(ready ? '#d8a33f' : '#6d4817');
    graphics.circle(x, y + radius / 2, radius / 2);
    graphics.fill();
    graphics.fillColor = color('#090705');
    graphics.circle(x, y - radius / 2, radius / 2);
    graphics.fill();
    graphics.circle(x, y + radius / 2, 3.4); graphics.fill();
    graphics.fillColor = color(ready ? '#d8a33f' : '#6d4817');
    graphics.circle(x, y - radius / 2, 3.4); graphics.fill();
}

function drawTrigrams(graphics: Graphics, x: number, y: number, radius: number, alpha: number): void {
    graphics.strokeColor = color('#d7a443', alpha);
    graphics.lineWidth = 3.2;
    for (let i = 0; i < 8; i += 1) {
        const a = i * Math.PI / 4;
        const cx = x + Math.cos(a) * radius;
        const cy = y + Math.sin(a) * radius;
        const tx = -Math.sin(a);
        const ty = Math.cos(a);
        for (let j = -1; j <= 1; j += 1) {
            const ox = Math.cos(a) * j * 6;
            const oy = Math.sin(a) * j * 6;
            graphics.moveTo(cx + ox - tx * 8, cy + oy - ty * 8);
            graphics.lineTo(cx + ox + tx * 8, cy + oy + ty * 8);
        }
    }
    graphics.stroke();
}

export function drawProgressRing(graphics: Graphics, progress: number): void {
    graphics.clear();
    graphics.strokeColor = color('#4f3512', 190);
    graphics.lineWidth = 5;
    graphics.arc(0, 0, 34, 0, Math.PI * 2, false);
    graphics.stroke();
    if (progress > 0) {
        graphics.strokeColor = color('#edc96e');
        graphics.lineWidth = 5;
        graphics.arc(0, 0, 34, Math.PI / 2, Math.PI / 2 - Math.PI * 2 * progress, true);
        graphics.stroke();
    }
}

export function drawParticleDot(graphics: Graphics, position: Point2, radius: number, hex: string, alpha: number): void {
    graphics.clear();
    graphics.fillColor = color(hex, alpha);
    graphics.circle(position.x, position.y, radius);
    graphics.fill();
}

export function resetNodeTransform(node: Node): void {
    node.setPosition(Vec3.ZERO);
    node.setScale(Vec3.ONE);
}
