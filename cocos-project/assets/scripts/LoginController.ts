import {
    _decorator,
    AudioClip,
    AudioSource,
    Color,
    Component,
    EventTouch,
    game,
    Graphics,
    Label,
    Mask,
    Node,
    ResolutionPolicy,
    resources,
    tween,
    Tween,
    UIOpacity,
    UITransform,
    Vec2,
    Vec3,
    view,
} from 'cc';
import { createMainLevel } from './core/LevelFactory';
import { distancePointToPolyline } from './core/Geometry';
import type { LevelConfig, PieceConfig, Point2, ZoneConfig, ZoneId } from './core/GameTypes';
import { GoldLinePiece } from './render/GoldLinePiece';
import {
    color,
    drawBackground,
    drawCentralSeal,
    drawCircularButton,
    drawHeaderDecoration,
    drawProgressRing,
    drawZoneFrame,
    drawZoneMedallion,
    makeGraphics,
    makeLabel,
    makeNode,
} from './ui/VectorUI';

const { ccclass } = _decorator;

interface RuntimePiece {
    config: PieceConfig;
    node: Node;
    view: GoldLinePiece;
    active: boolean;
}

interface RuntimeZone {
    config: ZoneConfig;
    frame: Graphics;
    medallion: Graphics;
    nameLabel: Label;
    statusLabel: Label;
    nameOpacity: UIOpacity;
    pieces: RuntimePiece[];
    done: boolean;
}

type SoundName = 'tap' | 'blocked' | 'remove' | 'unlock' | 'win';

@ccclass('LoginController')
export class LoginController extends Component {
    private readonly level: LevelConfig = createMainLevel();
    private readonly pieces = new Map<string, RuntimePiece>();
    private readonly zones = new Map<ZoneId, RuntimeZone>();
    private readonly clips = new Map<SoundName, AudioClip>();

    private boardViewport!: Node;
    private cameraLayer!: Node;
    private cameraTransform!: UITransform;
    private centralGraphics!: Graphics;
    private centralLabel!: Label;
    private centerHit!: Node;
    private heartGraphics!: Graphics;
    private progressGraphics!: Graphics;
    private progressLabel!: Label;
    private zoneLabel!: Label;
    private toastNode!: Node;
    private toastLabel!: Label;
    private toastOpacity!: UIOpacity;
    private modalRoot!: Node;
    private audioSource!: AudioSource;

    private currentZoneIndex = 0;
    private lives = 3;
    private moves = 0;
    private mistakes = 0;
    private hintCount = 3;
    private clearCount = 2;
    private undoCount = 3;
    private history: string[] = [];
    private busy = false;
    private centerReady = false;
    private focused = true;
    private selected: RuntimePiece | null = null;
    private touchStart = new Vec2();
    private touchMoved = false;
    private startedAt = 0;
    private soundEnabled = true;
    private vibrationEnabled = true;
    private assistEnabled = false;

    protected onLoad(): void {
        view.setDesignResolutionSize(750, 1334, ResolutionPolicy.FIXED_WIDTH);
        game.frameRate = 60;
        this.audioSource = this.node.addComponent(AudioSource);
        this.loadAudio();
        this.buildScene();
        this.validateLevel();
        this.resetGame(false);
        this.scheduleOnce(() => this.showTutorial(), 0.35);
    }

    protected onDestroy(): void {
        this.boardViewport?.off(Node.EventType.TOUCH_START, this.onBoardTouchStart, this);
        this.boardViewport?.off(Node.EventType.TOUCH_MOVE, this.onBoardTouchMove, this);
        this.boardViewport?.off(Node.EventType.TOUCH_END, this.onBoardTouchEnd, this);
        this.boardViewport?.off(Node.EventType.TOUCH_CANCEL, this.onBoardTouchCancel, this);
    }

    private buildScene(): void {
        const canvas = this.node;
        canvas.layer = 1 << 25;

        const background = makeGraphics(canvas, 'VectorBackground');
        drawBackground(background);
        const headerDecoration = makeGraphics(canvas, 'HeaderDecoration');
        drawHeaderDecoration(headerDecoration);

        this.createTopButton(-314, 585, 'back', () => this.showLevelInfo());
        this.createTopButton(-244, 585, 'reset', () => this.resetGame());
        this.createTopButton(314, 585, 'settings', () => this.showSettings());

        makeLabel(canvas, `关卡 ${this.level.no}`, 42, '#e6ba59', 0, 607, 300, 58);
        makeLabel(canvas, this.level.title, 32, '#d5a141', 0, 557, 330, 45);
        makeLabel(canvas, this.level.subtitle, 18, '#8f6524', 0, 514, 430, 30, false);

        this.heartGraphics = makeGraphics(canvas, 'Hearts', 0, 0, 210, 70);
        this.heartGraphics.node.setPosition(225, 570, 0);

        this.progressGraphics = makeGraphics(canvas, 'ProgressRing', -297, 489, 90, 90);
        this.progressLabel = makeLabel(canvas, '0/72', 20, '#f0ce76', -297, 488, 92, 34, false);
        this.zoneLabel = makeLabel(canvas, '', 20, '#c59438', 0, 482, 330, 34, false);

        // 可视窗口使用矩形 Mask，聚焦象限时不会覆盖顶部和底部 UI。
        this.boardViewport = makeNode(canvas, 'BoardViewport', 0, -28, 720, 842);
        const mask = this.boardViewport.addComponent(Mask);
        mask.type = Mask.Type.RECT;
        this.boardViewport.on(Node.EventType.TOUCH_START, this.onBoardTouchStart, this);
        this.boardViewport.on(Node.EventType.TOUCH_MOVE, this.onBoardTouchMove, this);
        this.boardViewport.on(Node.EventType.TOUCH_END, this.onBoardTouchEnd, this);
        this.boardViewport.on(Node.EventType.TOUCH_CANCEL, this.onBoardTouchCancel, this);

        this.cameraLayer = makeNode(this.boardViewport, 'BoardCamera', 0, 0, 750, 930);
        this.cameraTransform = this.cameraLayer.getComponent(UITransform)!;
        this.drawBoardFoundation();
        this.buildZonesAndPieces();
        this.buildCentralSeal();

        // 视口外框在 Mask 外绘制，始终保持锐利。
        const viewportFrame = makeGraphics(canvas, 'ViewportFrame', 0, -28, 720, 842);
        viewportFrame.strokeColor = color('#7b5117', 160);
        viewportFrame.lineWidth = 2;
        viewportFrame.roundRect(-359, -420, 718, 840, 22);
        viewportFrame.stroke();

        this.createBottomButton(-280, -579, 'hint', '提示', () => this.useHint());
        this.createBottomButton(-140, -579, 'undo', '撤回', () => this.undo());
        this.createBottomButton(0, -579, 'reset', '重置', () => this.resetGame());
        this.createBottomButton(140, -579, 'clear', '清除', () => this.useClear());
        this.createBottomButton(280, -579, 'focus', '聚焦', () => this.toggleFocus());

        this.buildToast();
        this.modalRoot = makeNode(canvas, 'ModalRoot', 0, 0, 750, 1334);
        const swallow = (event: EventTouch): void => { event.propagationStopped = true; };
        this.modalRoot.on(Node.EventType.TOUCH_START, swallow);
        this.modalRoot.on(Node.EventType.TOUCH_MOVE, swallow);
        this.modalRoot.on(Node.EventType.TOUCH_END, swallow);
        this.modalRoot.active = false;
    }

    private drawBoardFoundation(): void {
        const graphics = makeGraphics(this.cameraLayer, 'BoardFoundation', 0, 0, 750, 930);
        graphics.strokeColor = color('#4c310d', 170);
        graphics.lineWidth = 4;
        graphics.moveTo(-70, 8); graphics.lineTo(-51, 8);
        graphics.moveTo(51, 8); graphics.lineTo(70, 8);
        graphics.moveTo(0, 79); graphics.lineTo(0, 98);
        graphics.moveTo(0, -63); graphics.lineTo(0, -82);
        graphics.stroke();

        // 四方连纹和阵眼装饰。
        graphics.strokeColor = color('#8d5e1c', 88);
        graphics.lineWidth = 1.2;
        for (const zone of this.level.zones) {
            const sx = Math.sign(zone.origin.x) * 82;
            const sy = Math.sign(zone.origin.y) * 82;
            graphics.moveTo(sx, sy);
            graphics.lineTo(zone.origin.x - Math.sign(zone.origin.x) * 139, sy);
            graphics.lineTo(zone.origin.x - Math.sign(zone.origin.x) * 139, zone.origin.y - Math.sign(zone.origin.y) * 139);
        }
        graphics.stroke();

        // 阵盘星点。
        graphics.fillColor = color('#c28a2d', 65);
        const stars: Point2[] = [
            { x: -338, y: 12 }, { x: 338, y: 12 }, { x: 0, y: 394 }, { x: 0, y: -372 },
            { x: -344, y: 316 }, { x: 344, y: 316 }, { x: -344, y: -302 }, { x: 344, y: -302 },
        ];
        stars.forEach((p) => { graphics.circle(p.x, p.y, 2.4); graphics.fill(); });
    }

    private buildZonesAndPieces(): void {
        for (const zoneConfig of this.level.zones) {
            const frame = makeGraphics(this.cameraLayer, `${zoneConfig.shortName}-Frame`, 0, 0, 750, 930);
            const medallion = makeGraphics(this.cameraLayer, `${zoneConfig.shortName}-Medallion`, 0, 0, 750, 930);
            const nameLabel = makeLabel(
                this.cameraLayer,
                zoneConfig.shortName,
                19,
                zoneConfig.accent,
                zoneConfig.origin.x,
                zoneConfig.origin.y + 119,
                92,
                31,
            );
            const statusLabel = makeLabel(
                this.cameraLayer,
                '待启',
                15,
                '#73511e',
                zoneConfig.origin.x,
                zoneConfig.origin.y - 120,
                92,
                26,
                false,
            );
            const nameOpacity = nameLabel.node.addComponent(UIOpacity);
            const runtimeZone: RuntimeZone = {
                config: zoneConfig,
                frame,
                medallion,
                nameLabel,
                statusLabel,
                nameOpacity,
                pieces: [],
                done: false,
            };
            this.zones.set(zoneConfig.id, runtimeZone);
        }

        for (const pieceConfig of this.level.pieces) {
            const node = makeNode(this.cameraLayer, `Piece-${pieceConfig.id}`, 0, 0, 750, 930);
            const pieceView = node.addComponent(GoldLinePiece);
            pieceView.setup(pieceConfig);
            const runtime: RuntimePiece = { config: pieceConfig, node, view: pieceView, active: true };
            this.pieces.set(pieceConfig.id, runtime);
            this.zones.get(pieceConfig.zone)!.pieces.push(runtime);
        }
    }

    private buildCentralSeal(): void {
        this.centralGraphics = makeGraphics(this.cameraLayer, 'CentralSeal', 0, 0, 750, 930);
        this.centralLabel = makeLabel(this.cameraLayer, '封', 27, '#d74b32', 0, 8, 58, 44);
        this.centerHit = makeNode(this.cameraLayer, 'CenterHit', 0, 8, 170, 170);
        this.bindTap(this.centerHit, () => this.finishLevel());
    }

    private createTopButton(x: number, y: number, icon: 'back' | 'reset' | 'settings', handler: () => void): void {
        const graphics = makeGraphics(this.node, `Top-${icon}`, x, y, 62, 62);
        drawCircularButton(graphics, 28, icon);
        this.bindTap(graphics.node, handler);
    }

    private createBottomButton(
        x: number,
        y: number,
        icon: 'hint' | 'undo' | 'reset' | 'clear' | 'focus',
        label: string,
        handler: () => void,
    ): void {
        const graphics = makeGraphics(this.node, `Bottom-${icon}`, x, y, 76, 76);
        drawCircularButton(graphics, 34, icon);
        makeLabel(this.node, label, 18, '#d3a348', x, y - 52, 90, 30, false);
        this.bindTap(graphics.node, handler);
    }

    private buildToast(): void {
        this.toastNode = makeNode(this.node, 'Toast', 0, -484, 460, 62);
        this.toastOpacity = this.toastNode.addComponent(UIOpacity);
        this.toastOpacity.opacity = 0;
        const graphics = this.toastNode.addComponent(Graphics);
        graphics.fillColor = color('#0b0805', 238);
        graphics.strokeColor = color('#9c6820', 220);
        graphics.lineWidth = 2;
        graphics.roundRect(-225, -28, 450, 56, 18);
        graphics.fill(); graphics.stroke();
        this.toastLabel = makeLabel(this.toastNode, '', 20, '#f1d58e', 0, 0, 420, 42, false);
    }

    private resetGame(showToast = true): void {
        if (this.busy) return;
        this.busy = true;
        this.currentZoneIndex = 0;
        this.lives = 3;
        this.moves = 0;
        this.mistakes = 0;
        this.hintCount = 3;
        this.clearCount = 2;
        this.undoCount = 3;
        this.history = [];
        this.centerReady = false;
        this.startedAt = performance.now();
        this.selected = null;

        this.zones.forEach((zone) => { zone.done = false; });
        this.pieces.forEach((piece) => {
            piece.active = true;
            piece.node.active = true;
            piece.view.restore(false);
        });
        this.refreshBoard();
        this.focused = true;
        this.applyFocus(false);
        this.scheduleOnce(() => { this.busy = false; }, 0.12);
        if (showToast) this.toast('阵图已复原');
    }

    private refreshBoard(): void {
        const activeZone = this.currentZoneId();
        this.zones.forEach((zone, id) => {
            const active = !this.centerReady && id === activeZone;
            drawZoneFrame(zone.frame, zone.config, active, zone.done);
            drawZoneMedallion(zone.medallion, zone.config, zone.done, active);
            zone.nameOpacity.opacity = zone.done ? 255 : active ? 235 : 82;
            zone.statusLabel.string = zone.done ? '已归位' : active ? '解锁中' : '待启';
            zone.statusLabel.color = color(zone.done ? zone.config.accent : active ? '#d9a849' : '#69481a');
            zone.pieces.forEach((piece) => {
                if (piece.active) piece.view.setLocked(!active);
            });
        });
        drawCentralSeal(this.centralGraphics, this.centerReady);
        this.centralLabel.string = this.centerReady ? '归' : '封';
        this.centralLabel.color = color(this.centerReady ? '#f2d174' : '#d74b32');
        this.centerHit.active = this.centerReady;
        this.renderHearts();
        this.renderProgress();
    }

    private renderHearts(): void {
        const g = this.heartGraphics;
        g.clear();
        for (let i = 0; i < 3; i += 1) {
            const x = (i - 1) * 50;
            const alive = i < this.lives;
            g.fillColor = color(alive ? '#e44335' : '#4c1813', alive ? 255 : 115);
            g.strokeColor = color(alive ? '#ff8a6d' : '#6d2a21', alive ? 220 : 90);
            g.lineWidth = 1.5;
            g.moveTo(x, -16);
            g.bezierCurveTo(x - 29, 2, x - 23, 27, x, 18);
            g.bezierCurveTo(x + 23, 27, x + 29, 2, x, -16);
            g.close(); g.fill(); g.stroke();
        }
    }

    private renderProgress(): void {
        const removed = [...this.pieces.values()].filter((piece) => !piece.active).length;
        drawProgressRing(this.progressGraphics, removed / this.level.totalPieces);
        this.progressLabel.string = `${removed}/${this.level.totalPieces}`;
        if (this.centerReady) {
            this.zoneLabel.string = '四象已归 · 点击阵心';
            this.zoneLabel.color = color('#f0cc6d');
        } else {
            const zone = this.zones.get(this.currentZoneId());
            const zoneRemoved = zone ? zone.pieces.filter((piece) => !piece.active).length : 0;
            this.zoneLabel.string = `${zone?.config.name ?? ''}　${zoneRemoved}/18`;
            this.zoneLabel.color = color(zone?.config.accent ?? '#c59438');
        }
    }

    private currentZoneId(): ZoneId {
        return this.level.zoneOrder[Math.min(this.currentZoneIndex, this.level.zoneOrder.length - 1)];
    }

    private onBoardTouchStart(event: EventTouch): void {
        if (this.busy || this.centerReady) return;
        const local = this.touchToCamera(event);
        this.touchStart.set(local.x, local.y);
        this.touchMoved = false;
        this.selected = this.findNearestPiece(local, 36);
        this.selected?.view.setSelected(true);
    }

    private onBoardTouchMove(event: EventTouch): void {
        if (!this.selected) return;
        const local = this.touchToCamera(event);
        if (Vec2.distance(this.touchStart, local) > 14) {
            this.touchMoved = true;
            this.selected.view.setSelected(false);
            this.selected = null;
        }
    }

    private onBoardTouchEnd(): void {
        const target = this.selected;
        this.selected = null;
        if (!target || this.touchMoved) return;
        target.view.setSelected(false);
        this.attemptPiece(target);
    }

    private onBoardTouchCancel(): void {
        this.selected?.view.setSelected(false);
        this.selected = null;
        this.touchMoved = false;
    }

    private touchToCamera(event: EventTouch): Vec2 {
        const location = event.getUILocation();
        const local = this.cameraTransform.convertToNodeSpaceAR(new Vec3(location.x, location.y, 0));
        return new Vec2(local.x, local.y);
    }

    private findNearestPiece(point: Point2, radius: number): RuntimePiece | null {
        let nearest: RuntimePiece | null = null;
        let best = radius;
        const activeZone = this.currentZoneId();
        for (const piece of this.pieces.values()) {
            if (!piece.active || piece.config.zone !== activeZone) continue;
            const distance = distancePointToPolyline(point, piece.config.points);
            if (distance < best) {
                best = distance;
                nearest = piece;
            }
        }
        return nearest;
    }

    private attemptPiece(piece: RuntimePiece, free = false): void {
        if (this.busy || !piece.active || piece.config.zone !== this.currentZoneId()) return;
        const blockers = piece.config.blockers
            .map((id) => this.pieces.get(id))
            .filter((candidate): candidate is RuntimePiece => Boolean(candidate?.active));

        if (blockers.length > 0 && !free) {
            this.mistakes += 1;
            this.lives -= 1;
            piece.view.flashBlocker();
            blockers.forEach((blocker) => blocker.view.flashBlocker());
            this.play('blocked');
            this.vibrate(24);
            this.toast(`前方被 ${blockers.length} 笔锁纹阻挡`);
            this.renderHearts();
            if (this.lives <= 0) this.showFailure();
            return;
        }

        this.busy = true;
        piece.active = false;
        this.history.push(piece.config.id);
        this.moves += 1;
        this.spawnGoldDust(piece.view.arrowTip(), piece.config.exit);
        this.play('remove');
        this.vibrate(10);
        piece.view.flyOut(() => {
            piece.node.active = false;
            this.busy = false;
            this.renderProgress();
            this.checkZoneCompletion(piece.config.zone);
        });
    }

    private checkZoneCompletion(zoneId: ZoneId): void {
        const zone = this.zones.get(zoneId)!;
        if (zone.pieces.some((piece) => piece.active)) return;
        zone.done = true;
        this.play('unlock');
        this.vibrate([25, 24, 40]);
        this.toast(`${zone.config.shortName}归位`);
        drawZoneFrame(zone.frame, zone.config, false, true);
        drawZoneMedallion(zone.medallion, zone.config, true, false);
        Tween.stopAllByTarget(zone.medallion.node);
        tween(zone.medallion.node)
            .to(0.18, { scale: new Vec3(1.1, 1.1, 1) }, { easing: 'backOut' })
            .to(0.22, { scale: Vec3.ONE }, { easing: 'quadOut' })
            .start();

        this.currentZoneIndex += 1;
        if (this.currentZoneIndex >= this.level.zoneOrder.length) {
            this.centerReady = true;
            this.focused = false;
            this.refreshBoard();
            this.applyFocus(true);
            this.toast('四象归位 · 点击中央阵心');
            Tween.stopAllByTarget(this.centralGraphics.node);
            tween(this.centralGraphics.node)
                .repeatForever(
                    tween()
                        .to(0.65, { scale: new Vec3(1.055, 1.055, 1) }, { easing: 'sineOut' })
                        .to(0.65, { scale: Vec3.ONE }, { easing: 'sineIn' }),
                )
                .start();
            return;
        }

        this.refreshBoard();
        this.scheduleOnce(() => {
            this.focused = true;
            this.applyFocus(true);
        }, 0.42);
    }

    private useHint(): void {
        if (this.busy || this.centerReady) return;
        if (this.hintCount <= 0) {
            this.toast('提示次数已用尽');
            return;
        }
        const legal = this.legalMoves();
        if (legal.length === 0) {
            this.toast('当前无可行动作，请重置');
            return;
        }
        this.hintCount -= 1;
        legal[0].view.pulseHint();
        this.play('tap');
        this.toast(`提示剩余 ${this.hintCount} 次`);
    }

    private useClear(): void {
        if (this.busy || this.centerReady) return;
        if (this.clearCount <= 0) {
            this.toast('清除次数已用尽');
            return;
        }
        const legal = this.legalMoves();
        if (legal.length === 0) {
            this.toast('当前无可清除纹线');
            return;
        }
        this.clearCount -= 1;
        this.toast(`清除一笔 · 剩余 ${this.clearCount}`);
        this.attemptPiece(legal[0], true);
    }

    private undo(): void {
        if (this.busy || this.history.length === 0) {
            this.toast('暂无可撤回步骤');
            return;
        }
        if (this.undoCount <= 0) {
            this.toast('撤回次数已用尽');
            return;
        }
        this.undoCount -= 1;
        const id = this.history.pop()!;
        const piece = this.pieces.get(id)!;
        piece.active = true;
        piece.view.restore();
        this.moves = Math.max(0, this.moves - 1);
        const zoneIndex = this.level.zoneOrder.indexOf(piece.config.zone);
        this.currentZoneIndex = Math.min(this.currentZoneIndex, zoneIndex);
        this.centerReady = false;
        Tween.stopAllByTarget(this.centralGraphics.node);
        for (let i = zoneIndex; i < this.level.zoneOrder.length; i += 1) {
            this.zones.get(this.level.zoneOrder[i])!.done = false;
        }
        this.refreshBoard();
        this.focused = true;
        this.applyFocus(true);
        this.toast(`已撤回 · 剩余 ${this.undoCount}`);
    }

    private legalMoves(): RuntimePiece[] {
        const zone = this.currentZoneId();
        return [...this.pieces.values()].filter((piece) => {
            if (!piece.active || piece.config.zone !== zone) return false;
            return piece.config.blockers.every((id) => !this.pieces.get(id)?.active);
        });
    }

    private toggleFocus(): void {
        this.focused = !this.focused;
        this.applyFocus(true);
        this.toast(this.focused ? '聚焦当前象限' : '查看四象全局');
    }

    private applyFocus(animated: boolean): void {
        let scale = 1;
        let position = Vec3.ZERO;
        if (this.focused && !this.centerReady) {
            const zone = this.zones.get(this.currentZoneId())!.config;
            scale = 1.38;
            position = new Vec3(-zone.origin.x * scale, -zone.origin.y * scale, 0);
        }
        const targetScale = new Vec3(scale, scale, 1);
        Tween.stopAllByTarget(this.cameraLayer);
        if (animated) {
            tween(this.cameraLayer)
                .to(0.34, { position, scale: targetScale }, { easing: 'cubicOut' })
                .start();
        } else {
            this.cameraLayer.setPosition(position);
            this.cameraLayer.setScale(targetScale);
        }
    }

    private finishLevel(): void {
        if (!this.centerReady || this.busy) return;
        this.busy = true;
        Tween.stopAllByTarget(this.centralGraphics.node);
        this.play('win');
        this.vibrate([50, 35, 90]);
        const elapsed = Math.max(1, Math.round((performance.now() - this.startedAt) / 1000));
        const stars = this.mistakes === 0 ? 3 : this.mistakes <= 2 ? 2 : 1;
        tween(this.centralGraphics.node)
            .to(0.36, { scale: new Vec3(1.22, 1.22, 1), angle: 180 }, { easing: 'backOut' })
            .to(0.38, { scale: Vec3.ONE, angle: 360 }, { easing: 'cubicOut' })
            .call(() => {
                this.showModal(
                    '归',
                    '四象归真',
                    `${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}\n玄金吉印已成\n用时 ${this.formatTime(elapsed)}　步数 ${this.moves}　误判 ${this.mistakes}`,
                    '再玩一次',
                    () => { this.hideModal(); this.busy = false; this.resetGame(false); },
                    '继续观赏',
                    () => { this.hideModal(); this.busy = false; },
                );
            })
            .start();
    }

    private showFailure(): void {
        this.busy = true;
        this.showModal(
            '困',
            '阵心受损',
            `三次误判，封印重新闭合。\n已解 ${this.history.length}/${this.level.totalPieces}　步数 ${this.moves}`,
            '恢复一心',
            () => {
                this.lives = 1;
                this.busy = false;
                this.hideModal();
                this.renderHearts();
                this.toast('心力恢复');
            },
            '重新挑战',
            () => { this.busy = false; this.hideModal(); this.resetGame(false); },
        );
    }

    private showTutorial(): void {
        if (this.readFlag('sixiang-cocos-tutorial')) return;
        this.showModal(
            '解',
            '箭头即是真实出口',
            '点击一根金色纹线。\n箭头、阻挡判定与飞出动画共用同一方向。\n若前方被挡，真正的阻挡纹线会变为朱砂红。',
            '开始解阵',
            () => {
                this.writeFlag('sixiang-cocos-tutorial', '1');
                this.hideModal();
                this.toast('先寻找箭头前方完全畅通的纹线');
            },
        );
    }

    private showLevelInfo(): void {
        this.showModal(
            '阵',
            `关卡 ${this.level.no} · ${this.level.title}`,
            `产品级垂直切片\n72 根原生矢量锁纹 · 四象顺序解锁\n关卡求解器验证：可完整消除，无死关`,
            '继续挑战',
            () => this.hideModal(),
        );
    }

    private showSettings(): void {
        const soundText = this.soundEnabled ? '开' : '关';
        const vibrationText = this.vibrationEnabled ? '开' : '关';
        const assistText = this.assistEnabled ? '开' : '关';
        this.showModal(
            '设',
            '设置',
            `音效：${soundText}　震动：${vibrationText}\n合法动作微光辅助：${assistText}`,
            '切换音效',
            () => {
                this.soundEnabled = !this.soundEnabled;
                this.hideModal();
                this.showSettings();
            },
            '切换辅助',
            () => {
                this.assistEnabled = !this.assistEnabled;
                this.hideModal();
                if (this.assistEnabled) this.legalMoves().forEach((piece) => piece.view.pulseHint());
                this.showSettings();
            },
        );
    }

    private showModal(
        seal: string,
        title: string,
        body: string,
        primaryLabel: string,
        primaryAction: () => void,
        secondaryLabel?: string,
        secondaryAction?: () => void,
    ): void {
        this.modalRoot.active = true;
        this.modalRoot.children.slice().forEach((child) => child.destroy());
        const shade = makeGraphics(this.modalRoot, 'Shade');
        shade.fillColor = color('#000000', 182);
        shade.rect(-375, -667, 750, 1334); shade.fill();

        const panel = makeGraphics(this.modalRoot, 'Panel', 0, 0, 620, 660);
        panel.fillColor = color('#0b0805', 252);
        panel.strokeColor = color('#d0a03d');
        panel.lineWidth = 3;
        panel.roundRect(-300, -315, 600, 630, 30);
        panel.fill(); panel.stroke();
        panel.strokeColor = color('#6f4815');
        panel.lineWidth = 1.2;
        panel.roundRect(-286, -301, 572, 602, 24);
        panel.stroke();

        const sealGraphics = makeGraphics(this.modalRoot, 'Seal', 0, 206, 110, 110);
        sealGraphics.fillColor = color('#74170f');
        sealGraphics.strokeColor = color('#d69e39');
        sealGraphics.lineWidth = 3;
        sealGraphics.circle(0, 0, 48); sealGraphics.fill(); sealGraphics.stroke();
        makeLabel(this.modalRoot, seal, 48, '#f1ce72', 0, 207, 84, 70);
        makeLabel(this.modalRoot, title, 38, '#f0d28a', 0, 125, 490, 58);
        const bodyLabel = makeLabel(this.modalRoot, body, 23, '#cba65b', 0, -5, 500, 210, false);
        bodyLabel.enableWrapText = true;
        bodyLabel.overflow = Label.Overflow.SHRINK;
        bodyLabel.lineHeight = 36;

        if (secondaryLabel && secondaryAction) {
            this.createModalButton(-145, -225, secondaryLabel, false, secondaryAction);
            this.createModalButton(145, -225, primaryLabel, true, primaryAction);
        } else {
            this.createModalButton(0, -225, primaryLabel, true, primaryAction);
        }
    }

    private createModalButton(x: number, y: number, label: string, primary: boolean, action: () => void): void {
        const node = makeNode(this.modalRoot, `ModalButton-${label}`, x, y, 245, 82);
        const graphics = node.addComponent(Graphics);
        graphics.fillColor = color(primary ? '#7d1a10' : '#151008');
        graphics.strokeColor = color(primary ? '#e05b32' : '#a26d20');
        graphics.lineWidth = 2.5;
        graphics.roundRect(-118, -36, 236, 72, 20); graphics.fill(); graphics.stroke();
        makeLabel(node, label, 24, primary ? '#fff0bf' : '#e0bd6b', 0, 0, 220, 54, false);
        this.bindTap(node, action);
    }

    private hideModal(): void {
        this.modalRoot.active = false;
    }

    private bindTap(node: Node, handler: () => void): void {
        let moved = false;
        let start = new Vec2();
        node.on(Node.EventType.TOUCH_START, (event: EventTouch) => {
            const p = event.getUILocation();
            start = new Vec2(p.x, p.y);
            moved = false;
            Tween.stopAllByTarget(node);
            tween(node).to(0.06, { scale: new Vec3(0.95, 0.95, 1) }).start();
        });
        node.on(Node.EventType.TOUCH_MOVE, (event: EventTouch) => {
            const p = event.getUILocation();
            if (Vec2.distance(start, new Vec2(p.x, p.y)) > 12) moved = true;
        });
        node.on(Node.EventType.TOUCH_END, () => {
            Tween.stopAllByTarget(node);
            tween(node).to(0.08, { scale: Vec3.ONE }, { easing: 'backOut' }).start();
            if (!moved) {
                this.play('tap');
                handler();
            }
        });
        node.on(Node.EventType.TOUCH_CANCEL, () => {
            Tween.stopAllByTarget(node);
            tween(node).to(0.08, { scale: Vec3.ONE }).start();
        });
    }

    private toast(text: string): void {
        this.toastLabel.string = text;
        Tween.stopAllByTarget(this.toastOpacity);
        this.toastOpacity.opacity = 0;
        tween(this.toastOpacity)
            .to(0.12, { opacity: 255 })
            .delay(1.05)
            .to(0.22, { opacity: 0 })
            .start();
    }

    private spawnGoldDust(position: Point2, exit: Point2): void {
        for (let i = 0; i < 8; i += 1) {
            const node = makeNode(this.cameraLayer, `GoldDust-${i}`, position.x, position.y, 16, 16);
            const opacity = node.addComponent(UIOpacity);
            const graphics = node.addComponent(Graphics);
            graphics.fillColor = color(i % 3 === 0 ? '#fff1a5' : '#d79f34', 220);
            graphics.circle(0, 0, i % 3 === 0 ? 2.8 : 2.1); graphics.fill();
            const side = (i - 3.5) * 6;
            const perpendicular = { x: -exit.y, y: exit.x };
            const target = new Vec3(
                exit.x * (55 + i * 5) + perpendicular.x * side,
                exit.y * (55 + i * 5) + perpendicular.y * side,
                0,
            );
            tween(opacity).to(0.42, { opacity: 0 }).start();
            tween(node)
                .to(0.42, { position: target, scale: new Vec3(0.35, 0.35, 1) }, { easing: 'quadOut' })
                .call(() => node.destroy())
                .start();
        }
    }

    private loadAudio(): void {
        const names: SoundName[] = ['tap', 'blocked', 'remove', 'unlock', 'win'];
        names.forEach((name) => {
            resources.load(`audio/${name}`, AudioClip, (error, clip) => {
                if (!error && clip) this.clips.set(name, clip);
            });
        });
    }

    private play(name: SoundName): void {
        if (!this.soundEnabled) return;
        const clip = this.clips.get(name);
        if (clip) this.audioSource.playOneShot(clip, name === 'blocked' ? 0.62 : 0.8);
    }

    private vibrate(pattern: number | number[]): void {
        if (!this.vibrationEnabled || typeof navigator === 'undefined' || !navigator.vibrate) return;
        navigator.vibrate(pattern);
    }

    private validateLevel(): void {
        const active = new Set(this.level.pieces.map((piece) => piece.id));
        for (const id of this.level.solutionOrder) {
            const piece = this.level.pieces.find((candidate) => candidate.id === id);
            if (!piece) throw new Error(`求解序列引用不存在纹线：${id}`);
            const blockers = piece.blockers.filter((blocker) => active.has(blocker));
            if (blockers.length > 0) throw new Error(`关卡存在非法求解步骤：${id} <- ${blockers.join(',')}`);
            const last = piece.points[piece.points.length - 1];
            const before = piece.points[piece.points.length - 2];
            const dx = last.x - before.x;
            const dy = last.y - before.y;
            const length = Math.hypot(dx, dy) || 1;
            const alignment = dx / length * piece.exit.x + dy / length * piece.exit.y;
            if (alignment < 0.96) throw new Error(`箭头未与末段对齐：${id}`);
            active.delete(id);
        }
        if (active.size !== 0) throw new Error(`求解后仍剩余 ${active.size} 根纹线`);
        console.info(`[四象归真] 求解验证通过：${this.level.totalPieces} 根纹线，箭头/碰撞/动画方向统一。`);
    }

    private formatTime(seconds: number): string {
        return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    }

    private readFlag(key: string): string | null {
        try { return localStorage.getItem(key); } catch { return null; }
    }

    private writeFlag(key: string, value: string): void {
        try { localStorage.setItem(key, value); } catch { /* 部分小游戏运行时不提供 localStorage */ }
    }
}
