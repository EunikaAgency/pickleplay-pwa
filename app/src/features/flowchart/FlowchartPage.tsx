import { useState, useCallback, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
import {
  FLOW_DATA,
  type Perspective,
  type FlowNode,
} from './uxFlowData';

// ---------------------------------------------------------------------------
// /flowchart — a Figma-style, pannable/zoomable UX flowchart of the app's real
// user journeys, from two perspectives: Player and Owner.
//
// Layout: node cards are auto-stacked per column from their REAL rendered
// heights (measured after mount), so spacing stays even no matter how long a
// description runs. Arrows anchor to the measured card edges — side-to-side
// for cross-column links, top-to-bottom within a column.
// ---------------------------------------------------------------------------

const TYPE_META: Record<string, { bg: string; ink: string; label: string }> = {
  screen:       { bg: '#EEF2FF', ink: '#3B5CCC', label: 'Screen' },
  tab:          { bg: '#FFF0E6', ink: '#C26B1A', label: 'Tab' },
  section:      { bg: '#E8F5E9', ink: '#2E7D32', label: 'Section' },
  action:       { bg: '#FCE4EC', ink: '#C62828', label: 'Action' },
  modal:        { bg: '#F3E5F5', ink: '#7B1FA2', label: 'Modal' },
  drawer:       { bg: '#E0F7FA', ink: '#00695C', label: 'Drawer' },
  form:         { bg: '#FFF9C4', ink: '#F57F17', label: 'Form' },
  details:      { bg: '#E3F2FD', ink: '#0D47A1', label: 'Details' },
  summary:      { bg: '#FBE9E7', ink: '#BF360C', label: 'Summary' },
  confirmation: { bg: '#E8EAF6', ink: '#1A237E', label: 'Confirmation' },
};

const NODE_W = 250;       // fixed card width
const FALLBACK_H = 120;   // pre-measurement estimate
const COL_PITCH = 480;    // horizontal distance between column origins
const COL_X0 = 40;        // first column x
const ROW_GAP = 88;       // vertical gap between stacked cards
const ROW_Y0 = 40;        // column top

// Point on a cubic bezier at parameter t (used to place labels along a curve).
function cubicAt(t: number, a: number, b: number, c: number, d: number): number {
  const mt = 1 - t;
  return mt * mt * mt * a + 3 * mt * mt * t * b + 3 * mt * t * t * c + t * t * t * d;
}

// Stagger label positions along the curve so labels of edges sharing a source
// don't pile up at the same midpoint.
const LABEL_TS = [0.5, 0.3, 0.7, 0.4, 0.6, 0.25, 0.75];

type Size = { w: number; h: number };
type Sizes = Record<string, Size>;

function ArrowMarker() {
  return (
    <marker
      id="fc-arrow"
      viewBox="0 0 10 10"
      refX={8.5}
      refY={5}
      markerWidth={7.5}
      markerHeight={7.5}
      orient="auto-start-reverse"
    >
      <path d="M0,0 L10,5 L0,10 Z" fill="#94a3b8" />
    </marker>
  );
}

// Build the edge graphics with card-avoiding routing:
//  • adjacent columns  → S-curve through the gutter (never crosses a card)
//  • same column, adjacent rows → short vertical arrow in the row gap
//  • same column, cards in between → bow out through the left gutter
//  • 2+ columns apart  → paired connector points (A → … → A), no long line
// Anchors that share a card edge are fanned so arrows never stack, and every
// anchor slot is shared between entries AND exits on that edge.
type Side = 'R' | 'L' | 'B' | 'T';

interface EdgeItem {
  e: FlowEdgeLike;
  from: FlowNode;
  to: FlowNode;
  kind: 'side' | 'vert' | 'bow' | 'pair';
  sSide: Side;
  tSide: Side;
  sFrac: number;
  eFrac: number;
  li: number;
  letter?: string;
}

interface FlowEdgeLike { id: string; from: string; to: string; label: string }

interface PathGfx {
  id: string;
  text: string;
  path: string;
  labelPos: { x: number; y: number };
}

interface PairGfx {
  id: string;
  letter: string;
  text: string;
  srcStub: string;
  srcBox: { x: number; y: number; align: 'left' | 'right' };
  tgtStub: string;
  tgtBox: { x: number; y: number };
  /** World coords of each end — clicking one chip jumps the view to the other. */
  srcPos: { x: number; y: number };
  tgtPos: { x: number; y: number };
}

function buildEdgeGraphics(
  edges: FlowEdgeLike[],
  positioned: Map<string, FlowNode>,
  sizes: Sizes,
): { paths: PathGfx[]; pairs: PairGfx[] } {
  const colOf = (n: FlowNode) => Math.round((n.x - COL_X0) / COL_PITCH);
  const colNodes = new Map<number, FlowNode[]>();
  for (const n of positioned.values()) {
    const c = colOf(n);
    if (!colNodes.has(c)) colNodes.set(c, []);
    colNodes.get(c)!.push(n);
  }

  // Classify every edge.
  const items: EdgeItem[] = [];
  for (const e of edges) {
    const from = positioned.get(e.from);
    const to = positioned.get(e.to);
    if (!from || !to) continue;
    const dc = colOf(to) - colOf(from);
    let it: EdgeItem;
    if (Math.abs(dc) >= 2) {
      it = { e, from, to, kind: 'pair', sSide: dc > 0 ? 'R' : 'L', tSide: dc > 0 ? 'L' : 'R', sFrac: 0.5, eFrac: 0.5, li: 0 };
    } else if (dc === 1) {
      it = { e, from, to, kind: 'side', sSide: 'R', tSide: 'L', sFrac: 0.5, eFrac: 0.5, li: 0 };
    } else if (dc === -1) {
      it = { e, from, to, kind: 'side', sSide: 'L', tSide: 'R', sFrac: 0.5, eFrac: 0.5, li: 0 };
    } else {
      const [top, bot] = from.y < to.y ? [from, to] : [to, from];
      const topH = sizes[top.id]?.h ?? FALLBACK_H;
      const blocked = colNodes.get(colOf(from))!.some(
        (n) => n.id !== from.id && n.id !== to.id && n.y > top.y + topH - 1 && n.y < bot.y,
      );
      it = blocked
        ? { e, from, to, kind: 'bow', sSide: 'L', tSide: 'L', sFrac: 0.5, eFrac: 0.5, li: 0 }
        : { e, from, to, kind: 'vert', sSide: to.y > from.y ? 'B' : 'T', tSide: to.y > from.y ? 'T' : 'B', sFrac: 0.5, eFrac: 0.5, li: 0 };
    }
    items.push(it);
  }

  // Fan anchor slots per (card, side) — exits and entries share one fan so
  // two arrows can never touch the same point on a card edge.
  const slots = new Map<string, { sortKey: number; apply: (frac: number, i: number) => void }[]>();
  const addSlot = (cardId: string, side: Side, sortKey: number, apply: (frac: number, i: number) => void) => {
    const k = `${cardId}:${side}`;
    if (!slots.has(k)) slots.set(k, []);
    slots.get(k)!.push({ sortKey, apply });
  };
  for (const it of items) {
    const exitKey = it.sSide === 'B' || it.sSide === 'T' ? it.to.x : it.to.y;
    const entryKey = it.tSide === 'B' || it.tSide === 'T' ? it.from.x : it.from.y;
    addSlot(it.from.id, it.sSide, exitKey, (frac, i) => { it.sFrac = frac; it.li = i; });
    addSlot(it.to.id, it.tSide, entryKey, (frac) => { it.eFrac = frac; });
  }
  for (const arr of slots.values()) {
    arr.sort((a, b) => a.sortKey - b.sortKey);
    arr.forEach((s, i) => s.apply((i + 1) / (arr.length + 1), i));
  }

  // Assign connector letters in a stable order.
  const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let pi = 0;
  for (const it of items) {
    if (it.kind === 'pair') {
      it.letter = LETTERS[pi % 26] + (pi >= 26 ? String(Math.floor(pi / 26) + 1) : '');
      pi += 1;
    }
  }

  const anchor = (node: FlowNode, side: Side, frac: number): [number, number] => {
    const h = sizes[node.id]?.h ?? FALLBACK_H;
    if (side === 'R') return [node.x + NODE_W, node.y + h * frac];
    if (side === 'L') return [node.x, node.y + h * frac];
    if (side === 'B') return [node.x + NODE_W * frac, node.y + h];
    return [node.x + NODE_W * frac, node.y];
  };

  const paths: PathGfx[] = [];
  const pairs: PairGfx[] = [];
  for (const it of items) {
    const [sx, sy] = anchor(it.from, it.sSide, it.sFrac);
    const [ex, ey] = anchor(it.to, it.tSide, it.eFrac);
    if (it.kind === 'side') {
      const mx = (sx + ex) / 2;
      const t = LABEL_TS[it.li % LABEL_TS.length];
      paths.push({
        id: it.e.id,
        text: it.e.label,
        path: `M${sx},${sy} C${mx},${sy} ${mx},${ey} ${ex},${ey}`,
        labelPos: {
          x: cubicAt(t, sx, mx, mx, ex),
          y: cubicAt(t, sy, sy, ey, ey),
        },
      });
    } else if (it.kind === 'vert') {
      const my = (sy + ey) / 2;
      paths.push({
        id: it.e.id,
        text: it.e.label,
        path: `M${sx},${sy} C${sx},${my} ${ex},${my} ${ex},${ey}`,
        labelPos: { x: (sx + ex) / 2, y: my },
      });
    } else if (it.kind === 'bow') {
      // Bulge left into the gutter; depth varies with the fan slot so
      // sibling bows nest instead of overlapping.
      const depth = 44 + it.sFrac * 44;
      paths.push({
        id: it.e.id,
        text: it.e.label,
        path: `M${sx},${sy} C${sx - depth},${sy} ${ex - depth},${ey} ${ex},${ey}`,
        labelPos: { x: cubicAt(0.5, sx, sx - depth, ex - depth, ex), y: (sy + ey) / 2 },
      });
    } else {
      // Connector pair: a short labelled stub at the source, a matching
      // lettered stub at the target — no long line across the board.
      const sDir = it.sSide === 'R' ? 1 : -1;
      const tDir = it.tSide === 'L' ? -1 : 1;
      pairs.push({
        id: it.e.id,
        letter: it.letter ?? '?',
        text: it.e.label,
        srcStub: `M${sx},${sy} L${sx + 12 * sDir},${sy}`,
        srcBox: { x: it.sSide === 'R' ? sx + 14 : sx - 234, y: sy - 17, align: it.sSide === 'R' ? 'left' : 'right' },
        tgtStub: `M${ex + 34 * tDir},${ey} L${ex + 3 * tDir},${ey}`,
        tgtBox: { x: it.tSide === 'L' ? ex - 62 : ex + 38, y: ey - 17 },
        srcPos: { x: sx, y: sy },
        tgtPos: { x: ex, y: ey },
      });
    }
  }
  return { paths, pairs };
}

function NodeCard({ node, onRef }: { node: FlowNode; onRef: (el: HTMLDivElement | null) => void }) {
  const meta = TYPE_META[node.type] ?? TYPE_META.screen;
  return (
    <div
      ref={onRef}
      className="fc-node"
      style={{ left: node.x, top: node.y, width: NODE_W }}
    >
      <div className="fc-node-header">
        <span className="fc-node-title">{node.title}</span>
        <span className="fc-node-type" style={{ background: meta.bg, color: meta.ink }}>
          {meta.label}
        </span>
      </div>
      <div className="fc-node-module">{node.module}</div>
      <div className="fc-node-desc">{node.description}</div>
    </div>
  );
}

function ZoomControls({
  zoom,
  onZoomIn,
  onZoomOut,
  onRecenter,
}: {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onRecenter: () => void;
}) {
  return (
    <div className="fc-zoom-controls">
      <button className="fc-zoom-btn" onClick={onZoomIn} aria-label="Zoom in" title="Zoom in">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
      <button className="fc-zoom-btn" onClick={onZoomOut} aria-label="Zoom out" title="Zoom out">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
      <button className="fc-zoom-btn fc-recenter" onClick={onRecenter} aria-label="Re-center" title="Re-center">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
        </svg>
        <span>Re-center</span>
      </button>
      <span className="fc-zoom-pct">{Math.round(zoom * 100)}%</span>
    </div>
  );
}

function Legend() {
  return (
    <div className="fc-legend">
      {Object.entries(TYPE_META).map(([key, meta]) => (
        <span key={key} className="fc-legend-chip" style={{ background: meta.bg, color: meta.ink }}>
          {meta.label}
        </span>
      ))}
    </div>
  );
}

export default function FlowchartPage() {
  const [perspective, setPerspective] = useState<Perspective>('player');
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(0.55);
  const [dragging, setDragging] = useState(false);
  const [sizes, setSizes] = useState<Sizes>({});
  const last = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const nodeEls = useRef(new Map<string, HTMLDivElement>());

  const { nodes, edges } = FLOW_DATA[perspective];

  // Measure the real rendered height of every card so the layout and the
  // arrow anchors can be exact. Runs after mount and on perspective change.
  // DOM measurement is the sanctioned use of setState-in-layout-effect: the
  // guard below bails out when nothing changed, so it settles in one pass.
  useLayoutEffect(() => {
    const m: Sizes = {};
    for (const [id, el] of nodeEls.current) {
      if (el) m[id] = { w: el.offsetWidth, h: el.offsetHeight };
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSizes((prev) => {
      const ids = Object.keys(m);
      if (
        ids.length === Object.keys(prev).length &&
        ids.every((id) => prev[id] && prev[id].h === m[id].h && prev[id].w === m[id].w)
      ) {
        return prev; // no change — avoid a re-render loop
      }
      return m;
    });
  }, [perspective, nodes]);

  // Auto-layout: normalise columns to an even pitch, then stack each column's
  // cards from their measured heights with a constant gap. The authored (x, y)
  // in the data only set column membership and vertical ORDER.
  const positioned = useMemo(() => {
    const colXs = [...new Set(nodes.map((n) => n.x))].sort((a, b) => a - b);
    const colIndex = new Map(colXs.map((x, i) => [x, i]));
    const byCol = new Map<number, FlowNode[]>();
    for (const n of nodes) {
      const c = colIndex.get(n.x)!;
      if (!byCol.has(c)) byCol.set(c, []);
      byCol.get(c)!.push(n);
    }
    const out = new Map<string, FlowNode>();
    for (const [c, colNodes] of byCol) {
      colNodes.sort((a, b) => a.y - b.y);
      let y = ROW_Y0;
      for (const n of colNodes) {
        out.set(n.id, { ...n, x: COL_X0 + c * COL_PITCH, y });
        y += (sizes[n.id]?.h ?? FALLBACK_H) + ROW_GAP;
      }
    }
    return out;
  }, [nodes, sizes]);

  const positionedList = useMemo(() => [...positioned.values()], [positioned]);

  const edgeGfx = useMemo(
    () => buildEdgeGraphics(edges, positioned, sizes),
    [edges, positioned, sizes],
  );

  // Content bounding box from the laid-out cards + measured heights.
  const bounds = useMemo(() => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of positionedList) {
      const h = sizes[n.id]?.h ?? FALLBACK_H;
      if (n.x < minX) minX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.x + NODE_W > maxX) maxX = n.x + NODE_W;
      if (n.y + h > maxY) maxY = n.y + h;
    }
    if (!positionedList.length) return { x: 0, y: 0, w: 1200, h: 800 };
    const pad = 60;
    return { x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 };
  }, [positionedList, sizes]);

  // Fit-and-center, but never below a floor zoom that keeps text readable —
  // when the chart is wider than the screen, start at the flow's beginning
  // (left edge) and let the user pan right.
  const recenter = useCallback(() => {
    const cw = containerRef.current?.clientWidth ?? 1200;
    const ch = containerRef.current?.clientHeight ?? 800;
    const fit = Math.min(cw / bounds.w, ch / bounds.h);
    const z = Math.min(1.2, Math.max(0.55, fit));
    setZoom(z);
    setOffset({
      x: bounds.w * z <= cw ? (cw - bounds.w * z) / 2 - bounds.x * z : -bounds.x * z,
      y: bounds.h * z <= ch ? (ch - bounds.h * z) / 2 - bounds.y * z : -bounds.y * z,
    });
  }, [bounds]);

  // Fit the whole chart in view on load, when the perspective changes, and
  // once measurement lands (bounds — and therefore `recenter` — change then).
  useEffect(() => {
    recenter();
  }, [recenter]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const t = e.target as HTMLElement;
    if (t.closest('button') || t.closest('select')) return;
    setDragging(true);
    last.current = { x: e.clientX, y: e.clientY };
    t.setPointerCapture?.(e.pointerId);
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - last.current.x;
      const dy = e.clientY - last.current.y;
      last.current = { x: e.clientX, y: e.clientY };
      setOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
    },
    [dragging],
  );

  const onPointerUp = useCallback(() => setDragging(false), []);

  // Wheel zoom, anchored to the cursor.
  const onWheel = useCallback((e: React.WheelEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.08 : 1 / 1.08;
    setZoom((z) => {
      const newZoom = Math.min(2, Math.max(0.15, z * factor));
      const scale = newZoom / z;
      setOffset((prev) => ({
        x: mx - (mx - prev.x) * scale,
        y: my - (my - prev.y) * scale,
      }));
      return newZoom;
    });
  }, []);

  // Single-finger touch pans the canvas, not the page.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const prevent = (e: TouchEvent) => {
      if (e.touches.length === 1) e.preventDefault();
    };
    el.addEventListener('touchstart', prevent, { passive: false });
    el.addEventListener('touchmove', prevent, { passive: false });
    return () => {
      el.removeEventListener('touchstart', prevent);
      el.removeEventListener('touchmove', prevent);
    };
  }, []);

  const zoomIn = () => setZoom((z) => Math.min(2, z * 1.2));
  const zoomOut = () => setZoom((z) => Math.max(0.15, z / 1.2));

  // Center the view on a world-space point — used by the connector-point
  // chips: clicking one jumps to where its matching letter is.
  const jumpTo = useCallback(
    (wx: number, wy: number) => {
      const cw = containerRef.current?.clientWidth ?? 1200;
      const ch = containerRef.current?.clientHeight ?? 800;
      setOffset({ x: cw / 2 - wx * zoom, y: ch / 2 - wy * zoom });
    },
    [zoom],
  );

  const svgW = Math.max(3000, bounds.x + bounds.w + 400);
  const svgH = Math.max(2000, bounds.y + bounds.h + 400);

  return (
    <div className="fc-root">
      <header className="fc-header">
        <h1 className="fc-title">UX Flowchart</h1>
        <div className="fc-header-right">
          <Legend />
          <select
            className="fc-perspective-select"
            value={perspective}
            onChange={(e) => setPerspective(e.target.value as Perspective)}
            aria-label="Perspective"
          >
            <option value="player">Player</option>
            <option value="owner">Owner</option>
          </select>
        </div>
      </header>

      <div
        ref={containerRef}
        className="fc-canvas"
        style={{ cursor: dragging ? 'grabbing' : 'grab' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onWheel={onWheel}
      >
        <div
          className="fc-world"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
          }}
        >
          <svg
            className="fc-svg-layer"
            width={svgW}
            height={svgH}
            viewBox={`0 0 ${svgW} ${svgH}`}
            style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}
          >
            <defs>
              <ArrowMarker />
            </defs>
            {edgeGfx.paths.map((geo) => (
              <g key={geo.id}>
                <path
                  d={geo.path}
                  fill="none"
                  stroke="#b6c2d2"
                  strokeWidth={1.75}
                  markerEnd="url(#fc-arrow)"
                />
                <foreignObject
                  x={geo.labelPos.x - 100}
                  y={geo.labelPos.y - 17}
                  width={200}
                  height={34}
                  style={{ overflow: 'visible' }}
                >
                  <div className="fc-edge-labelwrap">
                    <span className="fc-edge-label" title={geo.text}>{geo.text}</span>
                  </div>
                </foreignObject>
              </g>
            ))}
            {edgeGfx.pairs.map((p) => (
              <g key={p.id}>
                <path d={p.srcStub} fill="none" stroke="#b6c2d2" strokeWidth={1.75} />
                <foreignObject
                  x={p.srcBox.x}
                  y={p.srcBox.y}
                  width={220}
                  height={34}
                  style={{ overflow: 'visible' }}
                >
                  <button
                    type="button"
                    className={`fc-portwrap${p.srcBox.align === 'right' ? ' fc-portwrap-r' : ''}`}
                    title={`Go to point ${p.letter}`}
                    onClick={() => jumpTo(p.tgtPos.x, p.tgtPos.y)}
                  >
                    <span className="fc-port-letter">{p.letter}</span>
                    <span className="fc-edge-label">{p.text}</span>
                  </button>
                </foreignObject>
                <path d={p.tgtStub} fill="none" stroke="#b6c2d2" strokeWidth={1.75} markerEnd="url(#fc-arrow)" />
                <foreignObject
                  x={p.tgtBox.x}
                  y={p.tgtBox.y}
                  width={26}
                  height={34}
                  style={{ overflow: 'visible' }}
                >
                  <button
                    type="button"
                    className="fc-portwrap"
                    title={`Back to point ${p.letter}`}
                    onClick={() => jumpTo(p.srcPos.x, p.srcPos.y)}
                  >
                    <span className="fc-port-letter">{p.letter}</span>
                  </button>
                </foreignObject>
              </g>
            ))}
          </svg>

          {positionedList.map((node) => (
            <NodeCard
              key={node.id}
              node={node}
              onRef={(el) => {
                if (el) nodeEls.current.set(node.id, el);
                else nodeEls.current.delete(node.id);
              }}
            />
          ))}
        </div>

        <ZoomControls zoom={zoom} onZoomIn={zoomIn} onZoomOut={zoomOut} onRecenter={recenter} />
      </div>
    </div>
  );
}
