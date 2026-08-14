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

const quoteBlock = (value: string) => value.trim().split('\n').map((line) => `> ${line}`).join('\n');
const bulletLines = (values: string[], empty = '-') => values.length > 0 ? values.map((value) => `- ${value}`).join('\n') : empty;

export const toMarkdown = (material: Material) => {
  const typeValues = material.argument_types.length > 0 ? material.argument_types : ['案例'];
  const domainValues = [material.primary.theme.name, material.primary.direction.name].filter(Boolean);
  const transferableValues = [material.primary.theme.name, material.primary.direction.name, ...material.keywords].filter(Boolean);
  const coreLogic = material.core_value || material.summary;
  return `---
类型:
${typeValues.map((value) => `  - ${value}`).join('\n')}
适用领域:
${domainValues.map((value) => `  - ${value}`).join('\n')}
来源: ${material.source}
时间: ${material.created_at.slice(0, 10)}
关键词:
${material.keywords.length > 0 ? material.keywords.map((value) => `  - ${value}`).join('\n') : '  - '}
状态: 待复习
复习次数: 0
tags:
  - 申论/素材库
---
# 原始素材

## 原文

${quoteBlock(material.content)}

## 金句

${bulletLines([])}

---
# 素材解析（AI整理）

## 核心逻辑

${quoteBlock(coreLogic)}

## 证明观点

${bulletLines(material.argument_types)}

## 可迁移方向

例如：

${bulletLines(transferableValues)}

---

# 我的加工

## ① 改写成申论语言

>

## ② 可以直接放进文章的句子

>

## ③ 我的理解

>
`;
};