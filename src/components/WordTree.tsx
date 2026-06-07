"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { WordNode } from "@/types";

let nodeIdCounter = 0;
function createNodeId(): string {
  return `node-${++nodeIdCounter}-${Date.now()}`;
}

/** 在树中查找指定 id 的节点 */
function findNode(root: WordNode, id: string): WordNode | null {
  if (root.id === id) return root;
  for (const child of root.children) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

/** 查找从根节点到指定 id 的路径，返回沿途所有词汇名 */
function findPath(root: WordNode, id: string, path: string[] = []): string[] | null {
  if (root.id === id) return [...path, root.word];
  for (const child of root.children) {
    const result = findPath(child, id, [...path, root.word]);
    if (result) return result;
  }
  return null;
}

/** 不可变更新树中指定 id 的节点 */
function updateNode(
  root: WordNode,
  id: string,
  updater: (node: WordNode) => WordNode
): WordNode {
  if (root.id === id) return updater(root);
  return {
    ...root,
    children: root.children.map((child) => updateNode(child, id, updater)),
  };
}

export default function WordTree() {
  const [root, setRoot] = useState<WordNode | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // rootRef 用于在异步回调中获取最新的 root 状态，避免闭包陈旧值问题
  const rootRef = useRef<WordNode | null>(null);

  useEffect(() => {
    rootRef.current = root;
  }, [root]);

  /**
   * 展开指定节点：调用 AI API 生成相关词汇并填充为子节点
   * 使用 rootRef.current 而非 root state，因为 useCallback 依赖为空数组
   */
  const expandWord = useCallback(async (nodeId: string) => {
    // 取消上一次未完成的请求
    if (abortRef.current) {
      abortRef.current.abort();
    }

    const controller = new AbortController();
    abortRef.current = controller;

    // 设置加载状态
    setRoot((prev) => {
      if (!prev) return prev;
      return updateNode(prev, nodeId, (node) => ({
        ...node,
        isLoading: true,
        isExpanded: true,
      }));
    });

    try {
      const currentRoot = rootRef.current;
      if (!currentRoot) return;

      // 获取从根到当前节点的路径，作为上下文传给 AI
      const path = findPath(currentRoot, nodeId);
      const targetNode = findNode(currentRoot, nodeId);
      if (!targetNode) return;

      // 构建上下文：排除当前节点本身，只保留祖先路径
      const contextParts = path ? path.slice(0, -1) : [];
      const context = contextParts.length > 0
        ? `联想路径: ${contextParts.join(" → ")}`
        : undefined;

      const response = await fetch("/api/expand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word: targetNode.word, context }),
        signal: controller.signal,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "展开失败");
      }

      const content = data.words || data;

      // 将 AI 返回的词汇列表转换为子节点
      setRoot((prev) => {
        if (!prev) return prev;
        return updateNode(prev, nodeId, (node) => ({
          ...node,
          isLoading: false,
          children: content.map((word: string) => ({
            id: createNodeId(),
            word,
            children: [],
            isExpanded: false,
            isLoading: false,
            parentId: nodeId,
          })),
        }));
      });
    } catch (err) {
      // 忽略取消请求的错误
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "展开失败");
      // 恢复节点状态
      setRoot((prev) => {
        if (!prev) return prev;
        return updateNode(prev, nodeId, (node) => ({
          ...node,
          isLoading: false,
          isExpanded: false,
        }));
      });
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const word = inputValue.trim();
    if (!word) return;

    setError(null);
    setInputValue("");

    // 创建根节点并立即触发展开
    const rootNode: WordNode = {
      id: createNodeId(),
      word,
      children: [],
      isExpanded: false,
      isLoading: false,
      parentId: null,
    };

    setRoot(rootNode);
    // 使用 setTimeout 确保 state 更新后再触发展开
    setTimeout(() => expandWord(rootNode.id), 100);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950">
      <div className="mx-auto max-w-4xl px-4 py-12">
        <header className="mb-10 text-center">
          <h1 className="mb-3 text-4xl font-bold tracking-tight text-gray-900 dark:text-white">
            词汇灵感发散器
          </h1>
          <p className="text-lg text-gray-500 dark:text-gray-400">
            输入一个词汇，AI 帮你无限发散灵感
          </p>
        </header>

        <form onSubmit={handleSubmit} className="mb-10 flex justify-center">
          <div className="flex w-full max-w-lg gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="输入一个词汇，如：海洋、时间、孤独..."
              className="flex-1 rounded-xl border border-gray-200 bg-white px-5 py-3 text-gray-900 shadow-sm transition-shadow focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-indigo-500 dark:focus:ring-indigo-800"
            />
            <button
              type="submit"
              className="rounded-xl bg-indigo-600 px-6 py-3 font-medium text-white shadow-sm transition-all hover:bg-indigo-700 hover:shadow-md active:bg-indigo-800 disabled:opacity-50"
              disabled={!inputValue.trim()}
            >
              发散
            </button>
          </div>
        </form>

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
            {error}
            <button
              onClick={() => setError(null)}
              className="ml-2 font-bold"
            >
              ×
            </button>
          </div>
        )}

        {root && (
          <div className="rounded-2xl border border-gray-200 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-gray-700 dark:bg-gray-800/80">
            <TreeNode
              node={root}
              depth={0}
              onExpand={expandWord}
            />
          </div>
        )}

        {!root && (
          <div className="text-center text-gray-400 dark:text-gray-500">
            <p className="text-6xl mb-4">💡</p>
            <p className="text-lg">在上方输入一个词汇，开始灵感之旅</p>
          </div>
        )}
      </div>
    </div>
  );
}

/** 递归渲染词汇树节点 */
function TreeNode({
  node,
  depth,
  onExpand,
}: {
  node: WordNode;
  depth: number;
  onExpand: (id: string) => void;
}) {
  const colors = [
    "bg-indigo-500",
    "bg-purple-500",
    "bg-blue-500",
    "bg-teal-500",
    "bg-emerald-500",
    "bg-amber-500",
    "bg-rose-500",
  ];
  const bgColor = colors[depth % colors.length];

  return (
    <div className={depth > 0 ? "ml-6 mt-2" : ""}>
      <div className="group flex items-center gap-2">
        {depth > 0 && (
          <div className="flex items-center">
            <div className="h-px w-4 bg-gray-300 dark:bg-gray-600" />
            <div
              className={`h-2 w-2 rounded-full ${bgColor} opacity-60`}
            />
          </div>
        )}
        <div
          className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-all ${
            depth === 0
              ? "bg-indigo-600 px-4 py-2 text-base shadow-md"
              : bgColor
          } ${node.isLoading ? "animate-pulse opacity-70" : ""}`}
        >
          {node.word}
          {node.isLoading && (
            <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
        </div>
        {!node.isLoading && node.children.length === 0 && (
          <button
            onClick={() => onExpand(node.id)}
            className="ml-1 rounded-md border border-gray-200 bg-white px-2 py-0.5 text-xs text-gray-500 opacity-0 shadow-sm transition-all group-hover:opacity-100 hover:border-indigo-300 hover:text-indigo-600 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-400 dark:hover:border-indigo-500 dark:hover:text-indigo-400"
          >
            + 发散
          </button>
        )}
      </div>

      {node.children.length > 0 && (
        <div className="relative mt-1">
          <div className="absolute left-3 top-0 bottom-2 w-px bg-gray-200 dark:bg-gray-700" />
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              onExpand={onExpand}
            />
          ))}
        </div>
      )}
    </div>
  );
}
