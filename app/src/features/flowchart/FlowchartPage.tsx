import { useState, useCallback, useRef, useEffect } from 'react';

interface FlowNode {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'rounded' | 'slanted' | 'arrow' | 'rectangle';
}

interface FlowEdge {
  from: string;
  to: string;
}

type Role = 'owner' | 'organizer' | 'player';

const ownerNodes: FlowNode[] = [
  { id: 'login', label: 'Login', x: 500, y: 40, width: 110, height: 44, type: 'rounded' },
  { id: 'dashboard', label: 'Owner Dashboard', x: 455, y: 115, width: 200, height: 52, type: 'slanted' },
  { id: 'home', label: 'Home Tab', x: 90, y: 250, width: 140, height: 52, type: 'slanted' },
  { id: 'venues', label: 'Venues Tab', x: 380, y: 250, width: 140, height: 52, type: 'slanted' },
  { id: 'clubs', label: 'Clubs Tab', x: 670, y: 250, width: 140, height: 52, type: 'slanted' },
  { id: 'profile', label: 'Profile Tab', x: 960, y: 250, width: 140, height: 52, type: 'slanted' },
  { id: 'claimVenue', label: 'Claim Venue', x: 300, y: 370, width: 145, height: 52, type: 'arrow' },
  { id: 'createVenue', label: 'Create Venue', x: 500, y: 370, width: 145, height: 52, type: 'arrow' },
  { id: 'fillForm', label: 'Fill Form', x: 535, y: 480, width: 100, height: 70, type: 'rectangle' },
  { id: 'viewVenue', label: 'View Venue', x: 500, y: 600, width: 150, height: 52, type: 'slanted' },
  { id: 'listing', label: 'Listing', x: 330, y: 720, width: 130, height: 52, type: 'slanted' },
  { id: 'location', label: 'Location', x: 500, y: 720, width: 130, height: 52, type: 'slanted' },
  { id: 'courts', label: 'Courts', x: 670, y: 720, width: 130, height: 52, type: 'slanted' },
];

const ownerEdges: FlowEdge[] = [
  { from: 'login', to: 'dashboard' },
  { from: 'dashboard', to: 'home' },
  { from: 'dashboard', to: 'venues' },
  { from: 'dashboard', to: 'clubs' },
  { from: 'dashboard', to: 'profile' },
  { from: 'venues', to: 'claimVenue' },
  { from: 'venues', to: 'createVenue' },
  { from: 'createVenue', to: 'fillForm' },
  { from: 'fillForm', to: 'viewVenue' },
  { from: 'viewVenue', to: 'listing' },
  { from: 'viewVenue', to: 'location' },
  { from: 'viewVenue', to: 'courts' },
];

function byId(nodes: FlowNode[]) {
  return new Map(nodes.map((n) => [n.id, n]));
}

function arrowMarker() {
  return (
    <marker id="fa" viewBox="0 0 10 10" refX={9} refY={5} markerWidth={7} markerHeight={7} orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 Z" fill="#94a3b8" />
    </marker>
  );
}

function edgePath(from: FlowNode, to: FlowNode): string {
  const fx = from.x + from.width / 2;
  const tx = to.x + to.width / 2;
  if (Math.abs(fx - tx) < 5) {
    return `M${fx},${from.y + from.height} L${fx},${to.y}`;
  }
  const my = (from.y + from.height + to.y) / 2;
  return `M${fx},${from.y + from.height} L${fx},${my} L${tx},${my} L${tx},${to.y}`;
}

function NodeShape({ n }: { n: FlowNode }) {
  const { x, y, w, h, label, type } = { w: n.width, h: n.height, ...n };
  const text = (
    <text x={x + w / 2} y={y + h / 2} textAnchor="middle" dominantBaseline="central"
      style={{ fontSize: 12, fontFamily: 'sans-serif', fontWeight: 500, fill: '#334155' }}>
      {label}
    </text>
  );

  if (type === 'slanted') {
    const s = 10;
    return (
      <g>
        <polygon points={`${x + s},${y} ${x + w},${y} ${x + w - s},${y + h} ${x},${y + h}`} fill="#fff" stroke="#cbd5e1" strokeWidth="1.5" />
        {text}
      </g>
    );
  }
  if (type === 'arrow') {
    const ah = 10;
    const pts = [`${x},${y}`, `${x + w - ah},${y}`, `${x + w},${y + h / 2}`, `${x + w - ah},${y + h}`, `${x},${y + h}`];
    return (
      <g>
        <polygon points={pts.join(' ')} fill="#fff" stroke="#cbd5e1" strokeWidth="1.5" />
        {text}
      </g>
    );
  }
  if (type === 'rectangle') {
    return (
      <g>
        <rect x={x} y={y} width={w} height={h} rx={6} ry={6} fill="#fff" stroke="#cbd5e1" strokeWidth="1.5" />
        {text}
      </g>
    );
  }
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={22} ry={22} fill="#fff" stroke="#cbd5e1" strokeWidth="1.5" />
      {text}
    </g>
  );
}

function Placeholder({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', width: '100%' }}>
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '24px 40px', textAlign: 'center' }}>
        <p style={{ color: '#94a3b8', fontSize: 18, fontWeight: 500, margin: 0 }}>{label}</p>
        <p style={{ color: '#cbd5e1', fontSize: 14, margin: '4px 0 0 0' }}>will be added later</p>
      </div>
    </div>
  );
}

export default function FlowchartPage() {
  const [role, setRole] = useState<Role>('owner');
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const last = useRef({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const t = e.target as HTMLElement;
    if (t.closest('text') || t.closest('polygon') || t.closest('rect')) return;
    setDragging(true);
    last.current = { x: e.clientX, y: e.clientY };
    t.setPointerCapture?.(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging) return;
    const dx = e.clientX - last.current.x;
    const dy = e.clientY - last.current.y;
    last.current = { x: e.clientX, y: e.clientY };
    setOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
  }, [dragging]);

  const onPointerUp = useCallback(() => setDragging(false), []);

  useEffect(() => {
    const el = canvasRef.current;
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

  const nodes = ownerNodes;
  const edges = ownerEdges;
  const map = byId(nodes);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', background: '#fff' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', height: 64, borderBottom: '1px solid #e2e8f0',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 18, fontWeight: 600, color: '#1e293b' }}>Flowchart</span>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          style={{
            border: '1px solid #cbd5e1', borderRadius: 8, padding: '6px 12px',
            fontSize: 14, color: '#334155', background: '#fff', outline: 'none',
          }}
        >
          <option value="owner">Owner</option>
          <option value="organizer">Organizer</option>
          <option value="player">Player</option>
        </select>
      </div>

      {/* Canvas */}
      <div
        ref={canvasRef}
        style={{
          flex: 1, position: 'relative', overflow: 'hidden',
          backgroundImage: 'radial-gradient(#d4d4d4 1px, transparent 1px)',
          backgroundSize: '18px 18px',
          backgroundColor: '#fafaf9',
          cursor: dragging ? 'grabbing' : 'grab',
          userSelect: 'none',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        {role === 'owner' ? (
          <div style={{ position: 'absolute', left: 0, top: 0, transform: `translate(${offset.x}px, ${offset.y}px)` }}>
            <svg width={1200} height={820} viewBox="0 0 1200 820" style={{ display: 'block' }}>
              <defs>{arrowMarker()}</defs>
              {edges.map((e, i) => {
                const from = map.get(e.from);
                const to = map.get(e.to);
                if (!from || !to) return null;
                return (
                  <path key={i} d={edgePath(from, to)} fill="none" stroke="#94a3b8"
                    strokeWidth="2" strokeLinejoin="round" markerEnd="url(#fa)" />
                );
              })}
              {nodes.map((n) => <NodeShape key={n.id} n={n} />)}
            </svg>
          </div>
        ) : role === 'organizer' ? (
          <Placeholder label="Organizer flowchart" />
        ) : (
          <Placeholder label="Player flowchart" />
        )}
      </div>
    </div>
  );
}
