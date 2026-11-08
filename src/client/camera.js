// =============================================================================
// Caméra de la scène : déplacement à la souris / au doigt, zoom à la molette,
// au pincement ou aux boutons, recadrage automatique ("tout voir").
// Un glisser de plus de 4 px n'est pas un clic (comme dans CroqueMotel).
// =============================================================================

const DRAG_THRESHOLD = 4;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2.2;

export class Camera {
  /**
   * @param viewport élément visible (overflow: hidden)
   * @param world    élément transformé (contient l'hôtel)
   */
  constructor(viewport, world, { onChange } = {}) {
    this.vp = viewport;
    this.world = world;
    this.x = 0;
    this.y = 0;
    this.scale = 1;
    this.onChange = onChange || (() => {});
    this.pointers = new Map();
    this.suppressClick = false;
    this.userMoved = false;
    this.bind();
  }

  /** Taille "naturelle" du monde (avant zoom). */
  size() {
    return { w: this.world.offsetWidth, h: this.world.offsetHeight };
  }

  apply() {
    this.clamp();
    this.world.style.transform = `translate(${this.x}px, ${this.y}px) scale(${this.scale})`;
    this.onChange(this);
  }

  /** Empêche de perdre l'hôtel hors de l'écran (centré s'il est plus petit que la vue). */
  clamp() {
    const { w, h } = this.size();
    const vw = this.vp.clientWidth;
    const vh = this.vp.clientHeight;
    const sw = w * this.scale;
    const sh = h * this.scale;
    const margin = 60;
    if (sw <= vw) this.x = (vw - sw) / 2;
    else this.x = Math.min(margin, Math.max(vw - sw - margin, this.x));
    if (sh <= vh) this.y = vh - sh; // posé en bas, comme un immeuble
    else this.y = Math.min(margin, Math.max(vh - sh, this.y)); // jamais de vide sous la rue
  }

  /** Cadre l'hôtel : toute la largeur du bâtiment, la rue en bas. */
  fit(focusEl = null) {
    const { w, h } = this.size();
    const vw = this.vp.clientWidth;
    const vh = this.vp.clientHeight;
    const target = focusEl ? focusEl.offsetWidth + 80 : w;
    this.scale = Math.max(MIN_ZOOM, Math.min(1.4, vw / target, vh / h));
    if (this.scale * h < vh * 0.6) this.scale = Math.min(MAX_ZOOM, vw / target); // petit hôtel : on le montre en grand
    this.x = (vw - w * this.scale) / 2;
    this.y = vh - h * this.scale;
    this.userMoved = false;
    this.apply();
  }

  /** Zoom autour d'un point de la vue (coordonnées écran relatives à la vue). */
  zoomAt(factor, cx = this.vp.clientWidth / 2, cy = this.vp.clientHeight / 2) {
    const ns = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, this.scale * factor));
    const k = ns / this.scale;
    this.x = cx - (cx - this.x) * k;
    this.y = cy - (cy - this.y) * k;
    this.scale = ns;
    this.userMoved = true;
    this.apply();
  }

  bind() {
    const vp = this.vp;
    const local = (e) => { const r = vp.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };

    vp.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      this.pointers.set(e.pointerId, { ...local(e), sx: e.clientX, sy: e.clientY });
      if (this.pointers.size === 1) {
        this.drag = { x0: this.x, y0: this.y, px: e.clientX, py: e.clientY, moved: false };
      } else if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), scale: this.scale };
        this.drag = null;
      }
    });

    vp.addEventListener('pointermove', (e) => {
      if (!this.pointers.has(e.pointerId)) return;
      this.pointers.set(e.pointerId, { ...this.pointers.get(e.pointerId), ...local(e) });
      if (this.pointers.size === 2 && this.pinch) {
        const [a, b] = [...this.pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const target = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, this.pinch.scale * (d / this.pinch.d)));
        this.zoomAt(target / this.scale, (a.x + b.x) / 2, (a.y + b.y) / 2);
        this.suppressClick = true;
        return;
      }
      const d = this.drag;
      if (!d) return;
      const dx = e.clientX - d.px;
      const dy = e.clientY - d.py;
      if (!d.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      if (!d.moved) { d.moved = true; vp.setPointerCapture?.(e.pointerId); vp.classList.add('dragging'); }
      this.x = d.x0 + dx;
      this.y = d.y0 + dy;
      this.userMoved = true;
      this.apply();
    });

    const end = (e) => {
      if (this.drag && this.drag.moved) this.suppressClick = true;
      this.pointers.delete(e.pointerId);
      if (this.pointers.size < 2) this.pinch = null;
      if (!this.pointers.size) { this.drag = null; vp.classList.remove('dragging'); }
    };
    vp.addEventListener('pointerup', end);
    vp.addEventListener('pointercancel', end);

    // Un glisser n'est pas un clic.
    vp.addEventListener('click', (e) => {
      if (this.suppressClick) { e.stopPropagation(); e.preventDefault(); this.suppressClick = false; }
    }, true);

    vp.addEventListener('wheel', (e) => {
      e.preventDefault();
      const p = local(e);
      if (e.ctrlKey || Math.abs(e.deltaY) >= Math.abs(e.deltaX)) this.zoomAt(Math.exp(-e.deltaY * 0.0015), p.x, p.y);
      else { this.x -= e.deltaX; this.userMoved = true; this.apply(); }
    }, { passive: false });

    window.addEventListener('resize', () => { if (this.userMoved) this.apply(); else this.fit(this.focusEl); });
  }
}
