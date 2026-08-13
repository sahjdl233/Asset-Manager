import type { MaterialAnalysis, CategoryRef } from '@workspace/api-client-react';

export type Material = MaterialAnalysis & {
  id: string;
  source: string;
  content: string;
  created_at: string;
  updated_at: string;
};

export const MATERIALS_KEY = 'shenlun-materials-v1';

export const readMaterials = (): Material[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(MATERIALS_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const writeMaterials = (materials: Material[]) => {
  localStorage.setItem(MATERIALS_KEY, JSON.stringify(materials));
};

export const emptyCategory = (): CategoryRef => ({
  dimension: { id: '', name: '待选择' },
  theme: { id: '', name: '待选择' },
  direction: { id: '', name: '待选择' },
});

export const makeMaterial = (analysis: MaterialAnalysis, content: string, source = '个人摘录'): Material => {
  const now = new Date().toISOString();
  return { ...analysis, id: crypto.randomUUID(), source, content, created_at: now, updated_at: now };
};

export const formatDate = (iso: string) =>
  new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

export const toMarkdown = (material: Material) => `# ${material.title}

> 来源：${material.source}

## 一句话概括
${material.summary}

## 原始材料
${material.content}

## 归类
- 维度：${material.primary.dimension.name}
- 主题：${material.primary.theme.name}
- 方向：${material.primary.direction.name}

## 核心价值
${material.core_value}

## 论据类型
${material.argument_types.map((item) => `- ${item}`).join('\n')}

## 关键词
${material.keywords.join('、')}
`;