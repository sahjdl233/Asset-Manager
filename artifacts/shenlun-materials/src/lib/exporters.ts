import { Document, HeadingLevel, Packer, Paragraph } from 'docx';

import { toMarkdown, type Material } from './materials';

export type ExportFormat = 'md' | 'txt' | 'json' | 'docx';

export const EXPORT_FORMATS: Array<{ value: ExportFormat; label: string }> = [
  { value: 'md', label: 'Markdown' },
  { value: 'txt', label: 'TXT' },
  { value: 'json', label: 'JSON' },
  { value: 'docx', label: 'DOCX' },
];

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

const fileBaseName = (material: Material) =>
  (material.title?.trim() || '未命名素材').replace(/[\\/:*?"<>|]/g, '_');

const bullet = (values: string[]) => (values.length > 0 ? values.map((value) => `- ${value}`).join('\n') : '-');

export const toPlainText = (material: Material) => {
  const domainValues = [material.primary.theme.name, material.primary.direction.name].filter(Boolean);
  const coreLogic = material.core_value || material.summary;
  return `# ${material.title || '未命名素材'}

来源: ${material.source}
时间: ${material.created_at.slice(0, 10)}
分类: ${[material.primary.dimension.name, ...domainValues].filter(Boolean).join(' / ') || '未分类'}
论据类型: ${material.argument_types.length > 0 ? material.argument_types.join('、') : '案例'}
关键词: ${material.keywords.length > 0 ? material.keywords.join('、') : '-'}
金句:
${bullet(material.quotes)}

## 素材正文

${material.content.trim()}

## AI 整理

摘要: ${material.summary}

核心价值: ${coreLogic}

可迁移方向:
${bullet([...domainValues, ...material.keywords])}
`;
};

export const toJson = (material: Material) => JSON.stringify(material, null, 2);

const heading = (text: string) => new Paragraph({ text, heading: HeadingLevel.HEADING_1 });
const bodyText = (text: string) => new Paragraph({ text: text || '-', spacing: { after: 120 } });
const metaLine = (label: string, value: string) => new Paragraph({ text: `${label}: ${value || '-'}`, spacing: { after: 60 } });

const buildDocx = (material: Material) => {
  const domainValues = [material.primary.theme.name, material.primary.direction.name].filter(Boolean);
  const transferableValues = [material.primary.theme.name, material.primary.direction.name, ...material.keywords].filter(Boolean);
  const coreLogic = material.core_value || material.summary;
  return new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({ text: material.title || '未命名素材', heading: HeadingLevel.TITLE }),
          metaLine('来源', material.source),
          metaLine('时间', material.created_at.slice(0, 10)),
          metaLine('分类', [material.primary.dimension.name, ...domainValues].filter(Boolean).join(' / ')),
          metaLine('论据类型', material.argument_types.join('、')),
          metaLine('关键词', material.keywords.join('、')),
          heading('金句'),
          ...(material.quotes.length > 0 ? material.quotes.map((quote) => bodyText(`- ${quote}`)) : [bodyText('-')]),
          heading('素材正文'),
          ...material.content.trim().split('\n').map((line) => new Paragraph({ text: line || ' ', spacing: { after: 80 } })),
          heading('AI 整理'),
          bodyText(`摘要: ${material.summary}`),
          bodyText(`核心价值: ${coreLogic}`),
          bodyText(`可迁移方向: ${transferableValues.join('、') || '-'}`),
        ],
      },
    ],
  });
};

export const exportMaterial = async (material: Material, format: ExportFormat) => {
  const baseName = fileBaseName(material);
  if (format === 'md') {
    downloadBlob(new Blob([toMarkdown(material)], { type: 'text/markdown;charset=utf-8' }), `${baseName}.md`);
    return;
  }
  if (format === 'txt') {
    downloadBlob(new Blob([toPlainText(material)], { type: 'text/plain;charset=utf-8' }), `${baseName}.txt`);
    return;
  }
  if (format === 'json') {
    downloadBlob(new Blob([toJson(material)], { type: 'application/json;charset=utf-8' }), `${baseName}.json`);
    return;
  }
  const blob = await Packer.toBlob(buildDocx(material));
  downloadBlob(blob, `${baseName}.docx`);
};
