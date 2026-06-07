export interface WordNode {
  id: string;
  word: string;
  children: WordNode[];
  isExpanded: boolean;
  isLoading: boolean;
  parentId: string | null;
}

export interface ExpandRequest {
  word: string;
  /** 联想路径上下文，如 "海洋 → 大海"，用于帮助 AI 理解当前词汇在灵感树中的位置 */
  context?: string;
  /** 已存在于图中的所有词汇，用于去重 */
  existingWords?: string[];
}

export interface ExpandResponse {
  words: string[];
  error?: string;
}
