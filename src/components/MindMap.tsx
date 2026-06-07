"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  forceSimulation,
  forceManyBody,
  forceCenter,
  forceLink,
  forceRadial,
  type Simulation,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from "d3-force";

interface GraphNode extends SimulationNodeDatum {
  id: string;
  word: string;
  depth: number;
  isRoot: boolean;
  isLoading: boolean;
  color: string;
  scale: number;
  /** 是否有子节点（已展开过） */
  expanded: boolean;
}

interface GraphEdge {
  source: string;
  target: string;
}

const COLORS = [
  "#6366f1", "#8b5cf6", "#3b82f6", "#06b6d4",
  "#10b981", "#f59e0b", "#f97316", "#ec4899",
];

function getDepthColor(depth: number): string {
  return COLORS[depth % COLORS.length];
}

let nodeCounter = 0;
function createId(): string {
  return `n-${++nodeCounter}-${Date.now()}`;
}

export default function MindMap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [inputValue, setInputValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isComposing, setIsComposing] = useState(false);
  const [isEmpty, setIsEmpty] = useState(true);
  const [loadingWord, setLoadingWord] = useState<string | null>(null);

  const nodesRef = useRef<GraphNode[]>([]);
  const edgesRef = useRef<GraphEdge[]>([]);
  const simRef = useRef<Simulation<GraphNode, SimulationLinkDatum<GraphNode>> | null>(null);
  const hoveredRef = useRef<string | null>(null);
  const dragRef = useRef<{ nodeId: string | null; offsetX: number; offsetY: number }>({
    nodeId: null, offsetX: 0, offsetY: 0,
  });
  const panRef = useRef({ x: 0, y: 0, dragging: false, startX: 0, startY: 0 });
  const animFrameRef = useRef<number>(0);
  const sizeRef = useRef({ w: 0, h: 0 });

  const restartSimulation = useCallback(() => {
    if (simRef.current) simRef.current.stop();
    const nodes = nodesRef.current;
    const edges = edgesRef.current;
    const { w, h } = sizeRef.current;

    const sim = forceSimulation(nodes)
      .force("link", forceLink<GraphNode, { source: string; target: string }>(
        edges.map((e) => ({ source: e.source, target: e.target }))
      ).id((d) => d.id).distance(160))
      .force("charge", forceManyBody().strength(-400))
      .force("center", forceCenter(w / 2, h / 2).strength(0.06))
      .force("radial", forceRadial<GraphNode>(
        (d) => (d.isRoot ? 0 : d.depth * 180), w / 2, h / 2
      ).strength(0.35))
      .alphaDecay(0.025)
      .on("tick", () => {});
    simRef.current = sim;
  }, []);

  /** 绘制背景：柔和渐变 + 微光点 */
  function drawBg(ctx: CanvasRenderingContext2D, w: number, h: number) {
    // 多层渐变
    const g1 = ctx.createRadialGradient(w * 0.3, h * 0.3, 0, w * 0.3, h * 0.3, w * 0.6);
    g1.addColorStop(0, "#f0f4ff");
    g1.addColorStop(1, "#e8ecf8");
    ctx.fillStyle = g1;
    ctx.fillRect(0, 0, w, h);

    const g2 = ctx.createRadialGradient(w * 0.7, h * 0.7, 0, w * 0.7, h * 0.7, w * 0.5);
    g2.addColorStop(0, "rgba(199, 210, 254, 0.4)");
    g2.addColorStop(1, "rgba(199, 210, 254, 0)");
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, w, h);

    const g3 = ctx.createRadialGradient(w * 0.5, h * 0.1, 0, w * 0.5, h * 0.1, w * 0.4);
    g3.addColorStop(0, "rgba(167, 243, 208, 0.15)");
    g3.addColorStop(1, "rgba(167, 243, 208, 0)");
    ctx.fillStyle = g3;
    ctx.fillRect(0, 0, w, h);

    // 微光点
    const t = Date.now() / 8000;
    ctx.fillStyle = "rgba(99, 102, 241, 0.06)";
    for (let i = 0; i < 30; i++) {
      const px = (Math.sin(i * 1.7 + t) * 0.5 + 0.5) * w;
      const py = (Math.cos(i * 2.3 + t * 0.7) * 0.5 + 0.5) * h;
      const pr = 40 + Math.sin(i + t * 2) * 20;
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { w, h } = sizeRef.current;
    const dpr = window.devicePixelRatio || 1;
    const pan = panRef.current;

    ctx.clearRect(0, 0, w * dpr, h * dpr);
    ctx.save();
    ctx.scale(dpr, dpr);
    drawBg(ctx, w, h);
    ctx.restore();

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.translate(pan.x, pan.y);

    const edges = edgesRef.current;
    const nodes = nodesRef.current;
    const hoveredId = hoveredRef.current;

    // 边
    edges.forEach((e) => {
      const src = nodes.find((n) => n.id === e.source);
      const tgt = nodes.find((n) => n.id === e.target);
      if (!src || !tgt) return;
      const alpha = Math.min(src.scale, tgt.scale);
      if (alpha < 0.01) return;

      ctx.beginPath();
      ctx.moveTo(src.x || 0, src.y || 0);
      const mx = ((src.x || 0) + (tgt.x || 0)) / 2;
      const my = ((src.y || 0) + (tgt.y || 0)) / 2;
      const dx = (tgt.x || 0) - (src.x || 0);
      const dy = (tgt.y || 0) - (src.y || 0);
      ctx.quadraticCurveTo(mx - dy * 0.08, my + dx * 0.08, tgt.x || 0, tgt.y || 0);
      ctx.strokeStyle = `rgba(148, 163, 184, ${0.35 * alpha})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });

    // 节点
    nodes.forEach((n) => {
      const x = n.x || 0;
      const y = n.y || 0;
      const isHovered = hoveredId === n.id;
      const r = n.isRoot ? 36 : isHovered ? 28 : 22;
      const s = n.scale;
      if (s < 0.01) return;
      const sr = r * s;

      // 阴影
      ctx.beginPath();
      ctx.arc(x, y + 2, sr, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0,0,0,${0.05 * s})`;
      ctx.fill();

      // 光晕
      ctx.beginPath();
      ctx.arc(x, y, sr + 5, 0, Math.PI * 2);
      ctx.fillStyle = n.color + Math.round(18 * s).toString(16).padStart(2, "0");
      ctx.fill();

      // 主体
      ctx.beginPath();
      ctx.arc(x, y, sr, 0, Math.PI * 2);
      const grad = ctx.createRadialGradient(x - sr * 0.3, y - sr * 0.3, 0, x, y, sr);
      grad.addColorStop(0, n.color + "dd");
      grad.addColorStop(1, n.color);
      ctx.fillStyle = grad;
      ctx.fill();

      if (n.isRoot || isHovered) {
        ctx.beginPath();
        ctx.arc(x, y, sr + 2, 0, Math.PI * 2);
        ctx.strokeStyle = n.color + "40";
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // 文字
      if (s > 0.5) {
        ctx.fillStyle = "#fff";
        ctx.font = `${n.isRoot ? "bold 14px" : "11px"} "PingFang SC","Microsoft YaHei",sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.globalAlpha = Math.min(1, (s - 0.5) * 2);
        const text = n.word.length > 5 ? n.word.slice(0, 4) + "…" : n.word;
        ctx.fillText(text, x, y);
        ctx.globalAlpha = 1;
      }

      // 加载动画
      if (n.isLoading) {
        const t = Date.now() / 400;
        const pulse = 0.5 + 0.5 * Math.sin(t * Math.PI * 2);
        ctx.beginPath();
        ctx.arc(x, y, sr + 4 + pulse * 5, 0, Math.PI * 2);
        ctx.strokeStyle = n.color + "30";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, sr + 7, t * Math.PI * 2, t * Math.PI * 2 + Math.PI * 1.2);
        ctx.strokeStyle = n.color;
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.stroke();
      }

      // +/− 按钮
      if (!n.isRoot && !n.isLoading && s > 0.8) {
        const bx = x + sr * 0.65;
        const by = y - sr * 0.65;
        ctx.beginPath();
        ctx.arc(bx, by, 6, 0, Math.PI * 2);
        ctx.fillStyle = "#fff";
        ctx.fill();
        ctx.strokeStyle = n.color;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = n.color;
        ctx.font = "bold 10px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(n.expanded ? "−" : "+", bx, by);
      }
    });

    ctx.restore();
  }, []);

  const drawFrameRef = useRef(drawFrame);
  useEffect(() => { drawFrameRef.current = drawFrame; }, [drawFrame]);

  const startDrawLoop = useCallback(() => {
    const loop = () => {
      drawFrameRef.current();
      animFrameRef.current = requestAnimationFrame(loop);
    };
    animFrameRef.current = requestAnimationFrame(loop);
  }, []);

  /** 递归收集后代 id（不含自身） */
  function collectDescendants(nodeId: string): string[] {
    const result: string[] = [];
    const stack = edgesRef.current.filter((e) => e.source === nodeId).map((e) => e.target);
    while (stack.length) {
      const id = stack.pop()!;
      result.push(id);
      edgesRef.current.filter((e) => e.source === id).forEach((e) => stack.push(e.target));
    }
    return result;
  }

  /** 折叠：移除所有后代节点和相关边 */
  function collapseNode(nodeId: string) {
    const descendants = collectDescendants(nodeId);
    const removeSet = new Set(descendants);

    // 立即移除（不等动画，避免bug）
    nodesRef.current = nodesRef.current.filter((n) => !removeSet.has(n.id));
    edgesRef.current = edgesRef.current.filter(
      (e) => !removeSet.has(e.source) && !removeSet.has(e.target) && e.source !== nodeId
    );
    // 标记父节点为未展开
    const parent = nodesRef.current.find((n) => n.id === nodeId);
    if (parent) parent.expanded = false;
    restartSimulation();
  }

  /** 展开节点 */
  const expandNode = useCallback(async (nodeId: string) => {
    const node = nodesRef.current.find((n) => n.id === nodeId);
    if (!node || node.isLoading) return;

    node.isLoading = true;
    setLoadingWord(node.word);

    // 构建路径上下文
    const pathWords: string[] = [];
    let cur: GraphNode | undefined = node;
    while (cur) {
      pathWords.unshift(cur.word);
      const edge = edgesRef.current.find((e) => e.target === cur!.id);
      cur = edge ? nodesRef.current.find((n) => n.id === edge.source) : undefined;
    }
    const context = pathWords.length > 1
      ? `联想路径: ${pathWords.slice(0, -1).join(" → ")}`
      : undefined;

    try {
      const res = await fetch("/api/expand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          word: node.word,
          context,
          existingWords: nodesRef.current.map((n) => n.word),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "展开失败");

      const words: string[] = data.words || [];
      const angleStep = (2 * Math.PI) / words.length;
      const radius = 160;

      const newNodes: GraphNode[] = words.map((w, i) => ({
        id: createId(),
        word: w,
        depth: node.depth + 1,
        isRoot: false,
        isLoading: false,
        color: getDepthColor(node.depth + 1),
        x: (node.x || 0) + Math.cos(angleStep * i - Math.PI / 2) * radius,
        y: (node.y || 0) + Math.sin(angleStep * i - Math.PI / 2) * radius,
        scale: 0,
        expanded: false,
      }));

      nodesRef.current = [...nodesRef.current, ...newNodes];
      edgesRef.current = [...edgesRef.current, ...newNodes.map((n) => ({ source: node.id, target: n.id }))];
      node.expanded = true;
      setIsEmpty(false);
      restartSimulation();
    } catch (err) {
      setError(err instanceof Error ? err.message : "展开失败");
    } finally {
      node.isLoading = false;
      setLoadingWord(null);
    }
  }, [restartSimulation]);

  // scale 动画
  useEffect(() => {
    const id = setInterval(() => {
      nodesRef.current.forEach((n) => {
        if (n.scale < 1) n.scale = Math.min(1, n.scale + 0.1);
      });
    }, 16);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      sizeRef.current = { w: rect.width, h: rect.height };
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
    };

    resize();
    window.addEventListener("resize", resize);
    startDrawLoop();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animFrameRef.current);
      if (simRef.current) simRef.current.stop();
    };
  }, [startDrawLoop]);

  const getMousePos = (e: React.MouseEvent): [number, number] => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
  };

  const getNodeAt = (mx: number, my: number): GraphNode | null => {
    const nodes = nodesRef.current;
    const pan = panRef.current;
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i];
      const nx = (n.x || 0) + pan.x;
      const ny = (n.y || 0) + pan.y;
      const r = n.isRoot ? 40 : 28;
      if ((mx - nx) ** 2 + (my - ny) ** 2 < r * r) return n;
    }
    return null;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const [mx, my] = getMousePos(e);
    const node = getNodeAt(mx, my);
    if (node) {
      dragRef.current = { nodeId: node.id, offsetX: mx - (node.x || 0) - panRef.current.x, offsetY: my - (node.y || 0) - panRef.current.y };
      if (simRef.current) { simRef.current.alphaTarget(0.3).restart(); node.fx = node.x; node.fy = node.y; }
    } else {
      panRef.current.dragging = true;
      panRef.current.startX = mx - panRef.current.x;
      panRef.current.startY = my - panRef.current.y;
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const [mx, my] = getMousePos(e);
    const drag = dragRef.current;
    if (drag.nodeId) {
      const node = nodesRef.current.find((n) => n.id === drag.nodeId);
      if (node) { node.fx = mx - drag.offsetX - panRef.current.x; node.fy = my - drag.offsetY - panRef.current.y; }
    } else if (panRef.current.dragging) {
      panRef.current.x = mx - panRef.current.startX;
      panRef.current.y = my - panRef.current.startY;
    } else {
      const node = getNodeAt(mx, my);
      hoveredRef.current = node?.id || null;
      canvasRef.current!.style.cursor = node ? "pointer" : "grab";
    }
  };

  const handleMouseUp = () => {
    const drag = dragRef.current;
    if (drag.nodeId) {
      const node = nodesRef.current.find((n) => n.id === drag.nodeId);
      if (node) { node.fx = null; node.fy = null; }
      if (simRef.current) simRef.current.alphaTarget(0);
    }
    dragRef.current = { nodeId: null, offsetX: 0, offsetY: 0 };
    panRef.current.dragging = false;
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    const [mx, my] = getMousePos(e);
    const node = getNodeAt(mx, my);
    if (!node || node.isLoading) return;
    if (node.expanded) {
      collapseNode(node.id);
    } else {
      expandNode(node.id);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isComposing) return;
    const word = inputValue.trim();
    if (!word) return;

    setError(null);
    setInputValue("");
    nodesRef.current = [];
    edgesRef.current = [];
    panRef.current.x = 0;
    panRef.current.y = 0;

    const { w, h } = sizeRef.current;
    const rootNode: GraphNode = {
      id: createId(), word, depth: 0, isRoot: true, isLoading: false,
      color: COLORS[0], x: w / 2, y: h / 2, scale: 1, expanded: false,
    };

    nodesRef.current = [rootNode];
    edgesRef.current = [];
    setIsEmpty(false);
    restartSimulation();
    setTimeout(() => expandNode(rootNode.id), 200);
  };

  return (
    <div className="flex h-screen flex-col" style={{ background: "linear-gradient(135deg, #f8faff 0%, #f0f4ff 50%, #eef2ff 100%)" }}>
      <header className="relative z-10 border-b border-indigo-100/50 bg-white/70 px-6 py-3 shadow-sm backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center gap-4">
          <h1 className="whitespace-nowrap text-lg font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            灵感发散器
          </h1>
          <form onSubmit={handleSubmit} className="flex flex-1 gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onCompositionStart={() => setIsComposing(true)}
              onCompositionEnd={() => setIsComposing(false)}
              placeholder="输入词汇，回车开始..."
              className="flex-1 rounded-xl border border-indigo-100 bg-white/80 px-4 py-2.5 text-sm text-slate-700 placeholder-slate-400 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
            />
            <button
              type="submit"
              className="rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 px-5 py-2.5 text-sm font-medium text-white shadow-md shadow-indigo-200/50 hover:shadow-lg hover:shadow-indigo-200/60 disabled:opacity-40"
              disabled={!inputValue.trim()}
            >
              发散
            </button>
          </form>
        </div>
        {error && (
          <div className="mx-auto mt-2 max-w-3xl rounded-xl border border-red-200 bg-red-50/80 px-3 py-1.5 text-xs text-red-600">
            {error}
            <button onClick={() => setError(null)} className="ml-2 font-bold">×</button>
          </div>
        )}
      </header>

      <div ref={containerRef} className="relative flex-1 overflow-hidden">
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onDoubleClick={handleDoubleClick}
          className="cursor-grab"
        />
        {loadingWord && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 rounded-full bg-white/80 px-4 py-1.5 text-xs text-indigo-500 shadow-lg backdrop-blur">
            <span className="mr-2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-indigo-300 border-t-indigo-600" />
            正在发散「{loadingWord}」...
          </div>
        )}
        {isEmpty && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <svg className="mb-4 h-14 w-14 text-indigo-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
              <circle cx="12" cy="12" r="3" />
              <ellipse cx="12" cy="12" rx="10" ry="4" />
              <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)" />
              <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(120 12 12)" />
            </svg>
            <p className="text-sm text-slate-400">输入词汇，开始灵感之旅</p>
            <p className="mt-1 text-xs text-slate-300">双击节点展开/折叠</p>
          </div>
        )}
      </div>

      <div className="border-t border-indigo-100/50 bg-white/70 px-6 py-2 text-center text-xs text-slate-400 backdrop-blur-xl">
        双击展开/折叠 · 拖拽节点 · 拖拽空白平移
      </div>
    </div>
  );
}
