import {
    _decorator,
    Color,
    Component,
    Graphics,
    Node,
    tween,
    Tween,
    UIOpacity,
    UITransform,
    Vec3,
} from 'cc';
import type { PieceConfig, Point2 } from '../core/GameTypes';

const { ccclass } = _decorator;

function color(hex: string, alpha = 255): Color {
    const value = new Color();
    value.fromHEX(hex);
    value.a = alpha;
    return value;
}

function setGraphicsDefaults(graphics: Graphics): void {
    graphics.lineCap = Graphics.LineCap.ROUND;
    graphics.lineJoin = Graphics.LineJoin.ROUND;
    graphics.miterLimit = 3;
}

@ccclass('GoldLinePiece')
export class GoldLinePiece extends Component {
    public config!: PieceConfig;

    private shadow!: Graphics;
    private rim!: Graphics;
    private body!: Graphics;
    private shine!: Graphics;
    private opacity!: UIOpacity;
    private selected = false;
    private hinted = false;
    private blocker = false;
    private locked = false;

    public setup(config: PieceConfig): void {
        this.config = config;
        this.node.layer = 1 << 25;
        const transform = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
        transform.setContentSize(750, 930);
        this.opacity = this.node.addComponent(UIOpacity);

        this.shadow = this.createLayer('Shadow');
        this.rim = this.createLayer('BronzeRim');
        this.body = this.createLayer('GoldBody');
        this.shine = this.createLayer('Highlight');
        this.redraw();
    }

    public setLocked(value: boolean): void {
        this.locked = value;
        this.opacity.opacity = value ? 72 : 255;
        this.redraw();
    }

    public setSelected(value: boolean): void {
        if (this.selected === value) return;
        this.selected = value;
        this.redraw();
        Tween.stopAllByTarget(this.node);
        tween(this.node)
            .to(0.07, { scale: new Vec3(value ? 1.035 : 1, value ? 1.035 : 1, 1) }, { easing: 'quadOut' })
            .start();
    }

    public pulseHint(): void {
        if (this.locked) return;
        this.hinted = true;
        this.redraw();
        Tween.stopAllByTarget(this.node);
        tween(this.node)
            .repeat(2,
                tween()
                    .to(0.22, { scale: new Vec3(1.055, 1.055, 1) }, { easing: 'quadOut' })
                    .to(0.22, { scale: new Vec3(1, 1, 1) }, { easing: 'quadIn' }),
            )
            .call(() => {
                this.hinted = false;
                this.redraw();
            })
            .start();
    }

    public flashBlocker(): void {
        this.blocker = true;
        this.redraw();
        Tween.stopAllByTarget(this.node);
        const x = this.node.position.x;
        tween(this.node)
            .to(0.045, { position: new Vec3(x - 5, 0, 0) })
            .to(0.045, { position: new Vec3(x + 5, 0, 0) })
            .to(0.045, { position: new Vec3(x - 3, 0, 0) })
            .to(0.07, { position: new Vec3(x, 0, 0) })
            .call(() => {
                this.blocker = false;
                this.redraw();
            })
            .start();
    }

    public flyOut(done: () => void): void {
        const distance = 520;
        const target = new Vec3(this.config.exit.x * distance, this.config.exit.y * distance, 0);
        Tween.stopAllByTarget(this.node);
        tween(this.opacity).to(0.18, { opacity: 0 }, { easing: 'quadIn' }).start();
        tween(this.node)
            .delay(0.025)
            .to(0.22, { position: target, scale: new Vec3(1.025, 1.025, 1) }, { easing: 'cubicIn' })
            .call(done)
            .start();
    }

    public restore(animate = true): void {
        this.node.active = true;
        this.node.setPosition(Vec3.ZERO);
        this.node.setScale(Vec3.ONE);
        this.opacity.opacity = 255;
        this.blocker = false;
        this.hinted = false;
        this.selected = false;
        this.redraw();
        if (animate) {
            this.node.setScale(0.9, 0.9, 1);
            tween(this.node)
                .to(0.18, { scale: Vec3.ONE }, { easing: 'backOut' })
                .start();
        }
    }

    public arrowTip(): Point2 {
        const p = this.config.points[this.config.points.length - 1];
        return {
            x: p.x + this.config.exit.x * 13,
            y: p.y + this.config.exit.y * 13,
        };
    }

    private createLayer(name: string): Graphics {
        const layer = new Node(name);
        layer.layer = 1 << 25;
        layer.parent = this.node;
        layer.addComponent(UITransform).setContentSize(750, 930);
        const graphics = layer.addComponent(Graphics);
        setGraphicsDefaults(graphics);
        return graphics;
    }

    private redraw(): void {
        if (!this.config || !this.shadow) return;
        const activeGold = this.selected || this.hinted;
        const bodyHex = this.blocker ? '#ef5a3a' : activeGold ? '#fff2ad' : this.locked ? '#785820' : '#d9a13a';
        const rimHex = this.blocker ? '#7b1710' : activeGold ? '#d59b34' : '#795017';
        const shineHex = this.blocker ? '#ffb08f' : activeGold ? '#fffbd6' : '#fff0a7';

        this.drawLayer(this.shadow, '#160c04', 13.5, 235, 1.1);
        this.drawLayer(this.rim, rimHex, 9.2, 255, 0.55);
        this.drawLayer(this.body, bodyHex, activeGold ? 6.2 : 5.7, 255, 0.0);
        this.drawLayer(this.shine, shineHex, 1.25, this.locked ? 38 : activeGold ? 245 : 135, -0.7);
    }

    private drawLayer(graphics: Graphics, hex: string, width: number, alpha: number, offsetY: number): void {
        graphics.clear();
        graphics.strokeColor = color(hex, alpha);
        graphics.fillColor = color(hex, alpha);
        graphics.lineWidth = width;

        const points = this.config.points;
        graphics.moveTo(points[0].x, points[0].y + offsetY);
        for (let i = 1; i < points.length; i += 1) {
            graphics.lineTo(points[i].x, points[i].y + offsetY);
        }
        graphics.stroke();
        this.drawArrow(graphics, points[points.length - 1], this.config.exit, width, offsetY);
    }

    private drawArrow(graphics: Graphics, end: Point2, direction: Point2, width: number, offsetY: number): void {
        const tipDistance = 13;
        const length = Math.max(11, width * 2.15);
        const half = Math.max(5.5, width * 1.12);
        const px = -direction.y;
        const py = direction.x;
        const tipX = end.x + direction.x * tipDistance;
        const tipY = end.y + offsetY + direction.y * tipDistance;
        const baseX = tipX - direction.x * length;
        const baseY = tipY - direction.y * length;

        graphics.moveTo(tipX, tipY);
        graphics.lineTo(baseX + px * half, baseY + py * half);
        graphics.lineTo(baseX - px * half, baseY - py * half);
        graphics.close();
        graphics.fill();
    }
}
