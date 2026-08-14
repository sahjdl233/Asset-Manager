import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { type CategoryRef, type MaterialAnalysis } from '@workspace/api-client-react';
import {
  AlertCircle,
  ArrowDown,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronDown,
  ClipboardPaste,
  Download,
  FileText,
  Filter,
  Library,
  PenLine,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { emptyCategory, makeMaterial, readMaterials, toMarkdown, writeMaterials, type Material } from '@/lib/materials';
import categories from '@/data/categories.json';
import { Route, Switch, Router as WouterRouter } from 'wouter';

type CategoryNode = (typeof categories.dimensions)[number];
type ThemeNode = (typeof categories.themes)[number];

const argumentTypes = ['政策背景', '问题表现', '原因分析', '实践路径', '成效案例', '经验启示', '对策建议', '价值意义'];
const OPENAI_SETTINGS_KEY = 'shenlun-openai-settings-v1';
const DEFAULT_OPENAI_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_OPENAI_MODEL = 'gpt-5-mini';

type OpenAISettings = {
  endpoint: string;
  apiKey: string;
  model: string;
};

const defaultOpenAISettings: OpenAISettings = {
  endpoint: DEFAULT_OPENAI_ENDPOINT,
  apiKey: '',
  model: DEFAULT_OPENAI_MODEL,
};

const readOpenAISettings = (): OpenAISettings => {
  try {
    const saved = JSON.parse(sessionStorage.getItem(OPENAI_SETTINGS_KEY) ?? '{}') as Partial<OpenAISettings>;
    return {
      endpoint: saved.endpoint?.trim() || DEFAULT_OPENAI_ENDPOINT,
      apiKey: saved.apiKey ?? '',
      model: saved.model?.trim() || DEFAULT_OPENAI_MODEL,
    };
  } catch {
    return defaultOpenAISettings;
  }
};

const normalizeEndpoint = (endpoint: string) => {
  const value = endpoint.trim().replace(/\/+$/, '');
  return value.endsWith('/chat/completions') ? value : `${value}/chat/completions`;
};

const normalizeModelsEndpoint = (endpoint: string) => {
  const value = endpoint.trim().replace(/\/+$/, '');
  if (value.endsWith('/chat/completions')) return `${value.slice(0, -'/chat/completions'.length)}/models`;
  if (value.endsWith('/models')) return value;
  return `${value}/models`;
};

const fetchModelsInBrowser = async (settings: OpenAISettings): Promise<string[]> => {
  if (!settings.apiKey.trim()) throw new Error('请先填写 API Key。');
  if (!settings.endpoint.trim()) throw new Error('请先填写接口地址。');
  const response = await fetch(normalizeModelsEndpoint(settings.endpoint), {
    headers: { Accept: 'application/json', Authorization: `Bearer ${settings.apiKey.trim()}` },
  });
  const raw = await response.text();
  let body: unknown = null;
  try {
    body = raw ? JSON.parse(raw) : null;
  } catch {
    body = null;
  }
  if (!response.ok) {
    const message = body && typeof body === 'object' && 'error' in body
      ? (body.error as { message?: string })?.message
      : undefined;
    throw new Error(message || `获取模型失败（HTTP ${response.status}）。请检查地址、Key 和跨域设置。`);
  }
  const candidates = Array.isArray(body) ? body : body && typeof body === 'object' && 'data' in body ? body.data : [];
  const models = Array.isArray(candidates)
    ? candidates.map((item) => typeof item === 'string' ? item : item && typeof item === 'object' && 'id' in item ? item.id : '').filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
  if (models.length === 0) throw new Error('接口返回成功，但没有找到可用模型。你仍可以手动填写模型名称。');
  return [...new Set(models)].sort();
};

const parseJsonContent = (content: string) => {
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(cleaned) as MaterialAnalysis;
};

const analyzeMaterialInBrowser = async (content: string, settings: OpenAISettings): Promise<MaterialAnalysis> => {
  if (!settings.apiKey.trim()) throw new Error('请先在“接口设置”中填写 API Key。');
  if (!settings.endpoint.trim()) throw new Error('请先填写 OpenAI 兼容接口地址。');

  const response = await fetch(normalizeEndpoint(settings.endpoint), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${settings.apiKey.trim()}`,
    },
    body: JSON.stringify({
      model: settings.model.trim() || DEFAULT_OPENAI_MODEL,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `你是申论素材整理助手。只输出合法 JSON，不要 Markdown 代码块。严格使用下面给出的分类词表，禁止创建、改写或猜测任何分类 ID、名称、方向和关键词。primary 必须有一个主分类，secondary 最多 3 个。argument_types 只能从固定论证场景中选择，最多 3 个。keywords 最多 5 个。

正式分类词表：
${JSON.stringify(categories, null, 2)}

固定论证场景：
${argumentTypes.join('、')}

JSON 结构必须为：
{
  "title": "标题",
  "summary": "一句话概括",
  "primary": { "dimension": { "id": "", "name": "" }, "theme": { "id": "", "name": "" }, "direction": { "id": "", "name": "" } },
  "secondary": [],
  "keywords": [],
  "argument_types": [],
  "core_value": "这条素材的核心价值及可迁移意义"
}`,
        },
        { role: 'user', content: `请分析以下申论素材：\n\n${content}` },
      ],
    }),
  });

  const raw = await response.text();
  let body: unknown = null;
  try {
    body = raw ? JSON.parse(raw) : null;
  } catch {
    body = null;
  }
  if (!response.ok) {
    const message = body && typeof body === 'object' && 'error' in body
      ? (body.error as { message?: string })?.message
      : undefined;
    throw new Error(message || `接口请求失败（HTTP ${response.status}）。请检查地址、Key 和跨域设置。`);
  }
  const messageContent = body && typeof body === 'object' && 'choices' in body
    ? (body.choices as Array<{ message?: { content?: string } }>)?.[0]?.message?.content
    : undefined;
  if (typeof messageContent !== 'string' || !messageContent.trim()) throw new Error('接口没有返回可解析的分析结果。');
  return normalizeAnalysis(parseJsonContent(messageContent));
};

const starterContent = `今年以来，多地持续探索“社区食堂”服务模式。上海市杨浦区将闲置空间改造成老年助餐点，引入社会力量参与运营，既解决了独居老人“吃饭难”，也让社区里的年轻人有了更便利的就餐选择。食堂不只提供一餐饭，还通过志愿服务、健康咨询等活动，把分散的居民重新组织起来。`;

const normalizeCategory = (input: CategoryRef | undefined): CategoryRef => {
  const dimension = categories.dimensions.find((item) => item.id === input?.dimension.id || item.name === input?.dimension.name) ?? categories.dimensions[0];
  const theme = categories.themes.find((item) => item.id === input?.theme.id || item.name === input?.theme.name) ?? categories.themes[0];
  const direction = theme.directions.find((item) => item.id === input?.direction.id || item.name === input?.direction.name) ?? theme.directions[0];
  return {
    dimension: { id: dimension.id, name: dimension.name },
    theme: { id: theme.id, name: theme.name },
    direction: { id: direction.id, name: direction.name },
  };
};

const normalizeAnalysis = (result: MaterialAnalysis): MaterialAnalysis => ({
  ...result,
  primary: normalizeCategory(result.primary),
  secondary: (result.secondary ?? []).slice(0, 3).map(normalizeCategory),
  keywords: (result.keywords ?? []).slice(0, 5),
  argument_types: (result.argument_types ?? []).slice(0, 3),
});

const downloadMarkdown = (material: Material) => {
  const blob = new Blob([toMarkdown(material)], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${material.title || '申论素材'}.md`;
  anchor.click();
  URL.revokeObjectURL(url);
};

function SettingsPanel({ value, onSave, onClose }: { value: OpenAISettings; onSave: (value: OpenAISettings) => void; onClose: () => void }) {
  const [draft, setDraft] = useState(value);
  const [models, setModels] = useState<string[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [modelError, setModelError] = useState('');
  const handleFetchModels = async () => {
    setIsFetchingModels(true);
    setModelError('');
    try {
      setModels(await fetchModelsInBrowser(draft));
    } catch (error) {
      setModels([]);
      setModelError(error instanceof Error ? error.message : '获取模型失败，请检查接口设置。');
    } finally {
      setIsFetchingModels(false);
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[hsl(var(--foreground)/.35)] px-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <div className="paper w-full max-w-xl shadow-2xl">
        <div className="paper-header">
          <div className="flex items-center gap-2.5"><div className="grid h-7 w-7 place-items-center rounded-lg bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]"><Settings size={15} /></div><div><div id="settings-title" className="text-sm font-semibold">接口设置</div><div className="text-[11px] text-[hsl(var(--muted-foreground))]">只在当前静态页面填写并调用</div></div></div>
          <button data-testid="button-close-settings" aria-label="关闭接口设置" className="action-subtle border-0 p-1.5" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="paper-body space-y-5">
          <div className="rounded-lg border border-[hsl(var(--accent)/.3)] bg-[hsl(var(--accent)/.07)] px-3 py-2.5 text-xs leading-5 text-[hsl(var(--foreground)/.75)]">请求会从浏览器直接发送到你填写的地址。Key 只保存在当前标签页的 sessionStorage 中，关闭标签页或窗口后会自动清除。</div>
          <label><span className="field-label">OpenAI 兼容接口地址</span><input data-testid="input-openai-endpoint" className="text-input px-3 py-2.5 text-sm" placeholder={DEFAULT_OPENAI_ENDPOINT} value={draft.endpoint} onChange={(event) => setDraft({ ...draft, endpoint: event.target.value })} /><span className="mt-1 block text-[11px] text-[hsl(var(--muted-foreground))]">可填写完整的 /chat/completions 地址，也可填写到 /v1。</span></label>
          <label><span className="field-label">API Key</span><div className="flex gap-2"><input data-testid="input-openai-key" type="password" autoComplete="off" className="text-input min-w-0 flex-1 px-3 py-2.5 text-sm" placeholder="sk-…" value={draft.apiKey} onChange={(event) => setDraft({ ...draft, apiKey: event.target.value })} /><button data-testid="button-fetch-models" type="button" className="action-subtle shrink-0 px-3 text-xs" disabled={isFetchingModels || !draft.endpoint.trim() || !draft.apiKey.trim()} onClick={handleFetchModels}>{isFetchingModels ? <><RefreshCw size={14} className="animate-spin" />获取中…</> : <><RefreshCw size={14} />获取模型</>}</button></div>{modelError && <span data-testid="status-model-error" className="mt-1 block text-[11px] text-[hsl(var(--destructive))]">{modelError}</span>}</label>
          <label><span className="field-label">模型名称</span><input data-testid="input-openai-model" className="text-input px-3 py-2.5 text-sm" placeholder={DEFAULT_OPENAI_MODEL} value={draft.model} onChange={(event) => setDraft({ ...draft, model: event.target.value })} />{models.length > 0 && <select data-testid="select-openai-model" className="select-input mt-2 px-3 py-2.5 text-sm" defaultValue="" onChange={(event) => { if (event.target.value) setDraft({ ...draft, model: event.target.value }); }}><option value="">从接口返回的模型中选择…</option>{models.map((model) => <option key={model} value={model}>{model}</option>)}</select>}<span className="mt-1 block text-[11px] text-[hsl(var(--muted-foreground))]">{models.length > 0 ? `已获取 ${models.length} 个模型，也可以直接手动填写。` : '也可以直接手动填写模型名称。'}</span></label>
          <div className="flex flex-wrap justify-end gap-2 border-t border-[hsl(var(--border))] pt-4"><button data-testid="button-clear-openai-settings" className="action-subtle mr-auto" onClick={() => setDraft(defaultOpenAISettings)}>清空配置</button><button data-testid="button-cancel-settings" className="action-subtle" onClick={onClose}>取消</button><button data-testid="button-save-settings" className="action-primary" onClick={() => onSave({ endpoint: draft.endpoint.trim(), apiKey: draft.apiKey, model: draft.model.trim() || DEFAULT_OPENAI_MODEL })}><Check size={15} />保存设置</button></div>
        </div>
      </div>
    </div>
  );
}

function Shell({ children, active, onNavigate, onSettings }: { children: ReactNode; active: 'desk' | 'library'; onNavigate: (view: 'desk' | 'library') => void; onSettings: () => void }) {
  return (
    <div className="app-shell noise">
      <aside className="sidebar">
        <div className="brand flex items-center gap-3 px-2">
          <div className="brand-mark">申</div>
          <div className="brand-copy">
            <div className="brand-word text-[17px]">申论素材库</div>
            <div className="mt-1 text-[10px] tracking-[.15em] text-[hsl(var(--sidebar-foreground)/.48)]">PERSONAL DESK</div>
          </div>
        </div>
        <nav className="mt-14 w-full" aria-label="主导航">
          <button data-testid="button-nav-desk" className={`nav-link w-full border-0 bg-transparent ${active === 'desk' ? 'active' : ''}`} onClick={() => onNavigate('desk')}>
            <PenLine size={17} strokeWidth={1.8} /><span className="nav-label">工作台</span>
          </button>
          <button data-testid="button-nav-library" className={`nav-link w-full border-0 bg-transparent ${active === 'library' ? 'active' : ''}`} onClick={() => onNavigate('library')}>
            <Library size={17} strokeWidth={1.8} /><span className="nav-label">我的素材</span>
          </button>
        </nav>
        <div className="sidebar-bottom mt-auto">
          <div className="sidebar-note rounded-xl border border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar-accent)/.6)] p-4">
            <div className="mono text-[10px] text-[hsl(var(--sidebar-primary))]">今日提示</div>
            <p className="sidebar-bottom-label mb-0 mt-2 text-xs leading-5 text-[hsl(var(--sidebar-foreground)/.68)]">好的素材不是囤积，而是下一次落笔时恰好想起。</p>
          </div>
          <div className="sidebar-bottom-label mt-5 px-2 text-[10px] tracking-[.12em] text-[hsl(var(--sidebar-foreground)/.35)]">LOCAL · PRIVATE · YOURS</div>
        </div>
      </aside>
      <main className="workspace">{children}</main>
    </div>
  );
}

function Topbar({ active, onNavigate, count, onSettings }: { active: 'desk' | 'library'; onNavigate: (view: 'desk' | 'library') => void; count: number; onSettings: () => void }) {
  return (
    <header className="topbar">
      <div className="flex items-center gap-3">
        <BookOpen size={18} className="text-[hsl(var(--primary))]" strokeWidth={1.8} />
        <span className="text-sm font-semibold">{active === 'desk' ? '工作台' : '我的素材'}</span>
        <span className="hidden text-xs text-[hsl(var(--muted-foreground))] sm:inline">/ {count} 条已保存</span>
      </div>
      <div className="flex items-center gap-2">
        <button data-testid="button-open-settings" className="action-subtle py-2 text-xs" onClick={onSettings}><Settings size={15} /> 接口设置</button>
        <button data-testid="button-new-material-top" className="action-primary py-2 text-xs" onClick={() => onNavigate('desk')}><Plus size={15} /> 新建素材</button>
      </div>
    </header>
  );
}

function CategoryEditor({ value, onChange }: { value: CategoryRef; onChange: (value: CategoryRef) => void }) {
  const dimension = categories.dimensions.find((item) => item.id === value.dimension.id) ?? categories.dimensions[0];
  const theme = categories.themes.find((item) => item.id === value.theme.id) ?? categories.themes[0];
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <label>
        <span className="field-label">维度</span>
        <span className="relative block">
          <select data-testid="select-category-dimension" className="select-input appearance-none px-3 py-2.5 text-sm" value={dimension.id} onChange={(event) => {
            const next = categories.dimensions.find((item) => item.id === event.target.value) ?? categories.dimensions[0];
            onChange({ ...value, dimension: { id: next.id, name: next.name } });
          }}>
            {categories.dimensions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select><ChevronDown size={15} className="pointer-events-none absolute right-3 top-3 text-[hsl(var(--muted-foreground))]" />
        </span>
      </label>
      <label>
        <span className="field-label">主题</span>
        <span className="relative block">
          <select data-testid="select-category-theme" className="select-input appearance-none px-3 py-2.5 text-sm" value={theme.id} onChange={(event) => {
            const nextTheme = categories.themes.find((item) => item.id === event.target.value) ?? categories.themes[0];
            onChange({ dimension: { id: dimension.id, name: dimension.name }, theme: { id: nextTheme.id, name: nextTheme.name }, direction: { id: nextTheme.directions[0].id, name: nextTheme.directions[0].name } });
          }}>
            {categories.themes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select><ChevronDown size={15} className="pointer-events-none absolute right-3 top-3 text-[hsl(var(--muted-foreground))]" />
        </span>
      </label>
      <label>
        <span className="field-label">方向</span>
        <span className="relative block">
          <select data-testid="select-category-direction" className="select-input appearance-none px-3 py-2.5 text-sm" value={value.direction.id} onChange={(event) => {
            const nextDirection = theme.directions.find((item) => item.id === event.target.value) ?? theme.directions[0];
            onChange({ ...value, direction: { id: nextDirection.id, name: nextDirection.name } });
          }}>
            {theme.directions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select><ChevronDown size={15} className="pointer-events-none absolute right-3 top-3 text-[hsl(var(--muted-foreground))]" />
        </span>
      </label>
    </div>
  );
}

function TagInput({ value, onChange, placeholder }: { value: string[]; onChange: (value: string[]) => void; placeholder: string }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const next = draft.trim();
    if (next && !value.includes(next) && value.length < 5) onChange([...value, next]);
    setDraft('');
  };
  return (
    <div className="rounded-[10px] border border-[hsl(var(--input))] bg-[hsl(var(--card))] p-2">
      <div className="mb-1 flex flex-wrap gap-1.5">
        {value.map((item) => <span className="chip" key={item}>{item}<button data-testid={`button-remove-keyword-${item}`} aria-label={`移除${item}`} className="border-0 bg-transparent p-0 text-[hsl(var(--muted-foreground))]" onClick={() => onChange(value.filter((tag) => tag !== item))}><X size={12} /></button></span>)}
      </div>
      <input data-testid="input-add-keyword" className="w-full border-0 bg-transparent px-1 py-1 text-xs outline-none" placeholder={placeholder} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ',') { event.preventDefault(); add(); } }} onBlur={add} />
    </div>
  );
}

function AnalysisForm({ analysis, setAnalysis }: { analysis: MaterialAnalysis; setAnalysis: (value: MaterialAnalysis) => void }) {
  const update = <K extends keyof MaterialAnalysis>(key: K, value: MaterialAnalysis[K]) => setAnalysis({ ...analysis, [key]: value });
  return (
    <div className="space-y-5">
      <div>
        <label className="field-label" htmlFor="analysis-title">标题</label>
        <input id="analysis-title" data-testid="input-analysis-title" className="text-input px-3 py-2.5 text-sm font-semibold" value={analysis.title} onChange={(event) => update('title', event.target.value)} />
      </div>
      <div>
        <label className="field-label" htmlFor="analysis-summary">一句话概括</label>
        <textarea id="analysis-summary" data-testid="textarea-analysis-summary" className="text-area min-h-[86px] px-3 py-2.5 text-sm" value={analysis.summary} onChange={(event) => update('summary', event.target.value)} />
      </div>
      <div>
        <div className="field-label">归类</div>
        <CategoryEditor value={analysis.primary} onChange={(value) => update('primary', value)} />
      </div>
      <div>
        <div className="mb-2 flex items-center justify-between">
          <div className="field-label mb-0">辅助分类 <span className="font-normal tracking-normal text-[hsl(var(--muted-foreground)/.7)]">· 最多 3 个</span></div>
          {analysis.secondary.length < 3 && <button data-testid="button-add-secondary" className="action-subtle border-0 px-1.5 py-1 text-xs" onClick={() => update('secondary', [...analysis.secondary, normalizeCategory(emptyCategory())])}><Plus size={13} />添加</button>}
        </div>
        {analysis.secondary.length === 0 ? <div className="rounded-lg border border-dashed border-[hsl(var(--border))] px-3 py-2.5 text-xs text-[hsl(var(--muted-foreground))]">没有明显的跨领域属性，可以保持为空。</div> : <div className="space-y-3">{analysis.secondary.map((category, index) => <div className="relative rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.25)] p-3" key={`${category.theme.id}-${index}`}><CategoryEditor value={category} onChange={(value) => update('secondary', analysis.secondary.map((item, itemIndex) => itemIndex === index ? value : item))} /><button data-testid={`button-remove-secondary-${index}`} aria-label={`移除辅助分类${index + 1}`} className="absolute right-2 top-2 rounded-md border-0 bg-transparent p-1 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--destructive)/.1)] hover:text-[hsl(var(--destructive))]" onClick={() => update('secondary', analysis.secondary.filter((_, itemIndex) => itemIndex !== index))}><X size={14} /></button></div>)}</div>}
      </div>
      <div>
        <div className="field-label">关键词 <span className="font-normal tracking-normal text-[hsl(var(--muted-foreground)/.7)]">· 回车添加</span></div>
        <TagInput value={analysis.keywords} onChange={(value) => update('keywords', value)} placeholder="例如：社区食堂" />
      </div>
      <div>
        <div className="field-label">论据类型 <span className="font-normal tracking-normal text-[hsl(var(--muted-foreground)/.7)]">· 可多选</span></div>
        <div className="flex flex-wrap gap-2">
          {argumentTypes.map((item) => {
            const selected = analysis.argument_types.includes(item);
            return <button data-testid={`button-argument-${item}`} key={item} className={`rounded-md border px-2.5 py-1.5 text-xs transition-colors ${selected ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'border-[hsl(var(--border))] bg-transparent text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]'}`} onClick={() => update('argument_types', selected ? analysis.argument_types.filter((type) => type !== item) : [...analysis.argument_types, item].slice(0, 3))}>{selected && <Check size={12} className="mr-1 inline" />}{item}</button>;
          })}
        </div>
      </div>
      <div>
        <label className="field-label" htmlFor="analysis-value">核心价值</label>
        <textarea id="analysis-value" data-testid="textarea-analysis-value" className="text-area min-h-[86px] px-3 py-2.5 text-sm" value={analysis.core_value} onChange={(event) => update('core_value', event.target.value)} />
      </div>
    </div>
  );
}

function EmptyAnalysis() {
  return (
    <div data-testid="empty-analysis" className="flex min-h-[530px] flex-col items-center justify-center px-7 text-center">
      <div className="mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-[hsl(var(--secondary)/.65)] text-[hsl(var(--primary))]"><Sparkles size={24} strokeWidth={1.5} /></div>
      <div className="serif text-lg font-semibold">等一段材料，变成你的论据</div>
      <p className="mt-2 max-w-[270px] text-xs leading-6 text-[hsl(var(--muted-foreground))]">AI 会先帮你搭好骨架。你来判断、修改，最后留下真正会在考场上用到的那一句。</p>
      <div className="mt-6 flex items-center gap-2 text-[10px] text-[hsl(var(--muted-foreground)/.7)]"><span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--accent))]" />建议粘贴 20 字以上的完整材料</div>
    </div>
  );
}

function AnalysisSkeleton() {
  return <div data-testid="loading-analysis" className="space-y-5 p-6"><div className="flex items-center gap-2 text-xs font-semibold text-[hsl(var(--primary))]"><span className="pulse-soft"><Sparkles size={15} /></span> 正在读这段材料</div><div className="skeleton h-4 w-2/3" /><div className="skeleton h-20 w-full" /><div className="grid grid-cols-3 gap-2"><div className="skeleton h-10" /><div className="skeleton h-10" /><div className="skeleton h-10" /></div><div className="skeleton h-28 w-full" /></div>;
}

function Editor({ onSaved, editing, onCancelEdit, settings, onOpenSettings }: { onSaved: (material: Material) => void; editing: Material | null; onCancelEdit: () => void; settings: OpenAISettings; onOpenSettings: () => void }) {
  const [content, setContent] = useState(editing?.content ?? '');
  const [source, setSource] = useState(editing?.source ?? '');
  const [analysis, setAnalysis] = useState<MaterialAnalysis | null>(editing ? { ...editing } : null);
  const [saveState, setSaveState] = useState<'idle' | 'saved'>('idle');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState('');

  useEffect(() => {
    setContent(editing?.content ?? '');
    setSource(editing?.source ?? '');
    setAnalysis(editing ? { ...editing } : null);
    setSaveState('idle');
    setAnalysisError('');
  }, [editing]);

  const handleAnalyze = async () => {
    if (content.trim().length < 20) return;
    setIsAnalyzing(true);
    setAnalysisError('');
    try {
      setAnalysis(await analyzeMaterialInBrowser(content.trim(), settings));
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : '分析没有完成，请检查接口设置后重试。');
    } finally {
      setIsAnalyzing(false);
    }
  };
  const handleSave = () => {
    if (!analysis || !content.trim()) return;
    const material = editing ? { ...editing, ...analysis, content: content.trim(), source: source.trim() || '个人摘录', updated_at: new Date().toISOString() } : makeMaterial(analysis, content.trim(), source.trim() || '个人摘录');
    onSaved(material);
    setSaveState('saved');
    window.setTimeout(() => setSaveState('idle'), 2200);
  };
  const handleExport = () => {
    if (!analysis || !content.trim()) return;
    const material = editing ? { ...editing, ...analysis, content: content.trim(), source: source.trim() || '个人摘录' } : makeMaterial(analysis, content.trim(), source.trim() || '个人摘录');
    downloadMarkdown(material);
  };
  return (
    <section id="editor" className="editor-grid rise-in-delay">
      <div className="paper">
        <div className="paper-header">
          <div className="flex items-center gap-2.5"><div className="grid h-7 w-7 place-items-center rounded-lg bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]"><ClipboardPaste size={15} /></div><div><div className="text-sm font-semibold">原始材料</div><div className="text-[11px] text-[hsl(var(--muted-foreground))]">先放进来，不急着整理</div></div></div>
          {content && <button data-testid="button-clear-content" className="action-subtle border-0 px-1.5 py-1 text-xs" onClick={() => { setContent(''); setAnalysis(null); }}><X size={14} />清空</button>}
        </div>
        <div className="paper-body">
          <label className="field-label" htmlFor="material-source">来源 <span className="font-normal tracking-normal">· 可选</span></label>
          <input id="material-source" data-testid="input-material-source" className="text-input mb-5 px-3 py-2.5 text-sm" placeholder="例如：人民日报 · 2024.06.18" value={source} onChange={(event) => setSource(event.target.value)} />
          <label className="field-label" htmlFor="material-content">材料正文</label>
          <textarea id="material-content" data-testid="textarea-material-content" className="text-area min-h-[400px] px-4 py-3.5 text-[14px]" placeholder={starterContent} value={content} onChange={(event) => setContent(event.target.value)} />
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="mono text-[10px] text-[hsl(var(--muted-foreground))]">{content.length} 字</span>
            <button data-testid="button-analyze-material" className="action-primary" disabled={content.trim().length < 20 || isAnalyzing} onClick={() => settings.apiKey.trim() ? handleAnalyze() : onOpenSettings()}>{isAnalyzing ? <><span className="pulse-soft"><Sparkles size={16} /></span> 分析中…</> : settings.apiKey.trim() ? <><Sparkles size={16} /> AI 分析</> : <><Settings size={16} /> 配置接口</>}</button>
          </div>
          {content.trim().length > 0 && content.trim().length < 20 && <div className="mt-3 flex items-center gap-2 text-xs text-[hsl(var(--accent))]"><AlertCircle size={14} />再多写一点，至少 20 个字</div>}
          {analysisError && <div data-testid="status-analysis-error" className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-[hsl(var(--destructive)/.3)] bg-[hsl(var(--destructive)/.06)] px-3 py-2.5 text-xs text-[hsl(var(--destructive))]"><span className="flex items-center gap-2"><AlertCircle size={14} />{analysisError}</span><button data-testid="button-retry-analysis" className="font-bold underline" onClick={handleAnalyze}>重试</button></div>}
        </div>
      </div>
      <div className="paper analysis-panel">
        <div className="paper-header">
          <div className="flex items-center gap-2.5"><div className="grid h-7 w-7 place-items-center rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"><Sparkles size={15} /></div><div><div className="text-sm font-semibold">AI 分析草稿</div><div className="text-[11px] text-[hsl(var(--muted-foreground))]">每一项都可以改，决定权在你</div></div></div>
          {analysis && <span className="chip chip-warm text-[10px]"><PenLine size={11} />可编辑</span>}
        </div>
          {isAnalyzing ? <AnalysisSkeleton /> : analysis ? <div className="paper-body"><AnalysisForm analysis={analysis} setAnalysis={setAnalysis} /><div className="mt-7 flex flex-wrap justify-end gap-2 border-t border-[hsl(var(--border))] pt-5">{editing && <button data-testid="button-cancel-edit" className="action-subtle" onClick={onCancelEdit}>取消编辑</button>}<button data-testid="button-export-draft" className="action-subtle" onClick={handleExport}><Download size={16} />直接导出 Markdown</button><button data-testid="button-save-material" className="action-primary" onClick={handleSave} disabled={!analysis.title.trim()}>{saveState === 'saved' ? <><Check size={16} />已保存</> : <><Download size={16} />保存到素材库</>}</button></div></div> : <EmptyAnalysis />}
      </div>
      {saveState === 'saved' && <div data-testid="status-save-success" className="toast-save fixed bottom-8 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full bg-[hsl(var(--sidebar))] px-4 py-2.5 text-xs font-semibold text-[hsl(var(--sidebar-foreground))] shadow-xl"><Check size={14} className="text-[hsl(var(--sidebar-primary))]" />已放入你的素材库</div>}
    </section>
  );
}

function MaterialCard({ material, onEdit, onDelete, onExport }: { material: Material; onEdit: () => void; onDelete: () => void; onExport: () => void }) {
  return (
    <article data-testid={`card-material-${material.id}`} className="material-card group">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[hsl(var(--secondary)/.7)] text-[hsl(var(--primary))]"><FileText size={14} /></span><span className="mono truncate text-[10px] text-[hsl(var(--muted-foreground))]">{material.source || '个人摘录'}</span></div>
        <div className="flex shrink-0 items-center gap-1 opacity-60 transition-opacity group-hover:opacity-100"><button data-testid={`button-edit-material-${material.id}`} className="rounded-md border-0 bg-transparent p-1.5 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]" aria-label="编辑素材" onClick={onEdit}><PenLine size={14} /></button><button data-testid={`button-export-material-${material.id}`} className="rounded-md border-0 bg-transparent p-1.5 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]" aria-label="导出 Markdown" onClick={onExport}><Download size={14} /></button><button data-testid={`button-delete-material-${material.id}`} className="rounded-md border-0 bg-transparent p-1.5 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--destructive)/.1)] hover:text-[hsl(var(--destructive))]" aria-label="删除素材" onClick={onDelete}><Trash2 size={14} /></button></div>
      </div>
      <h3 data-testid={`text-material-title-${material.id}`} className="serif mt-4 line-clamp-2 text-[17px] font-semibold leading-7">{material.title || '未命名素材'}</h3>
      <p data-testid={`text-material-summary-${material.id}`} className="mt-2 line-clamp-2 text-xs leading-5 text-[hsl(var(--muted-foreground))]">{material.summary}</p>
      <div className="mt-4 flex flex-wrap gap-1.5"><span className="chip text-[10px]">{material.primary.dimension.name}</span><span className="chip text-[10px]">{material.primary.theme.name}</span>{material.keywords.slice(0, 2).map((tag) => <span className="chip chip-warm text-[10px]" key={tag}>#{tag}</span>)}</div>
      <div className="mt-5 flex items-center justify-between border-t border-[hsl(var(--border))] pt-3 text-[10px] text-[hsl(var(--muted-foreground)/.8)]"><span>{material.argument_types[0] || '待补充论据类型'}</span><span>{new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric' }).format(new Date(material.updated_at))}</span></div>
    </article>
  );
}

function LibrarySection({ materials, onEdit, onDelete }: { materials: Material[]; onEdit: (material: Material) => void; onDelete: (id: string) => void }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const filtered = useMemo(() => materials.filter((material) => {
    const haystack = `${material.title} ${material.summary} ${material.keywords.join(' ')} ${material.content}`;
    return haystack.toLowerCase().includes(query.toLowerCase()) && (filter === 'all' || material.primary.dimension.id === filter);
  }), [materials, query, filter]);
  return (
    <section id="library" className="mt-24 rise-in">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div><div className="eyebrow">YOUR ARCHIVE</div><h2 className="headline mt-2 text-3xl font-bold">留下来的，才是素材</h2><p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">在你的视角里重新组织过的证据。</p></div>
        <div className="flex items-center gap-2"><span className="mono hidden text-[10px] text-[hsl(var(--muted-foreground))] sm:inline">{materials.length.toString().padStart(2, '0')} ENTRIES</span><ArrowDown size={14} className="text-[hsl(var(--accent))]" /></div>
      </div>
      <div className="mb-5 flex flex-col gap-2 sm:flex-row">
        <label className="relative flex-1"><Search size={16} className="absolute left-3 top-3 text-[hsl(var(--muted-foreground))]" /><input data-testid="input-search-materials" className="text-input py-2.5 pl-9 pr-3 text-sm" placeholder="搜索标题、关键词或原文…" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        <label className="relative sm:w-48"><Filter size={15} className="pointer-events-none absolute left-3 top-3 text-[hsl(var(--muted-foreground))]" /><select data-testid="select-filter-dimension" className="select-input appearance-none py-2.5 pl-9 pr-8 text-sm" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">全部维度</option>{categories.dimensions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><ChevronDown size={15} className="pointer-events-none absolute right-3 top-3 text-[hsl(var(--muted-foreground))]" /></label>
      </div>
      {filtered.length === 0 ? <div data-testid="empty-library" className="paper flex min-h-[255px] flex-col items-center justify-center text-center"><div className="mb-4 grid h-12 w-12 place-items-center rounded-full border border-dashed border-[hsl(var(--primary)/.4)] text-[hsl(var(--primary))]"><Library size={21} strokeWidth={1.5} /></div><div className="serif font-semibold">{materials.length === 0 ? '你的素材库还空着' : '没有找到这条素材'}</div><p className="mt-2 text-xs leading-5 text-[hsl(var(--muted-foreground))]">{materials.length === 0 ? '从上面贴一段新闻，给下一次写作留一盏灯。' : '试试换一个关键词，或清除筛选条件。'}</p></div> : <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">{filtered.map((material) => <MaterialCard key={material.id} material={material} onEdit={() => onEdit(material)} onDelete={() => onDelete(material.id)} onExport={() => downloadMarkdown(material)} />)}</div>}
    </section>
  );
}

function Home() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [active, setActive] = useState<'desk' | 'library'>('desk');
  const [editing, setEditing] = useState<Material | null>(null);
  const [openAISettings, setOpenAISettings] = useState<OpenAISettings>(defaultOpenAISettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  useEffect(() => {
    setMaterials(readMaterials());
    setOpenAISettings(readOpenAISettings());
  }, []);
  const saveOpenAISettings = (next: OpenAISettings) => {
    setOpenAISettings(next);
    sessionStorage.setItem(OPENAI_SETTINGS_KEY, JSON.stringify(next));
    setSettingsOpen(false);
  };
  const persist = (next: Material[]) => { setMaterials(next); writeMaterials(next); };
  const handleSaved = (material: Material) => {
    const exists = materials.some((item) => item.id === material.id);
    persist(exists ? materials.map((item) => item.id === material.id ? material : item) : [material, ...materials]);
    setEditing(null);
  };
  const handleDelete = (id: string) => {
    if (window.confirm('确定要删除这条素材吗？删除后无法恢复。')) persist(materials.filter((item) => item.id !== id));
  };
  const handleEdit = (material: Material) => {
    setEditing(material); setActive('desk'); window.setTimeout(() => document.getElementById('editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 40);
  };
  return (
    <Shell active={active} onNavigate={(view) => { setActive(view); if (view === 'library') window.setTimeout(() => document.getElementById('library')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 40); }} onSettings={() => setSettingsOpen(true)}>
      <Topbar active={active} onNavigate={(view) => { setActive(view); if (view === 'desk') window.scrollTo({ top: 0, behavior: 'smooth' }); }} count={materials.length} onSettings={() => setSettingsOpen(true)} />
      <div className="content-wrap">
        {active === 'desk' ? <><div className="mb-9 flex flex-wrap items-end justify-between gap-5 rise-in"><div><div className="eyebrow">A QUIET PLACE TO THINK</div><h1 data-testid="text-workspace-title" className="headline mt-3 max-w-[650px] text-4xl font-bold sm:text-5xl">把看见的，<br /><span className="text-[hsl(var(--primary))]">变成能写的。</span></h1><p className="mt-4 max-w-[490px] text-sm leading-6 text-[hsl(var(--muted-foreground))]">粘贴一段新闻、政策或案例。AI 负责拆解，你负责判断。每一次编辑，都是把别人的故事变成自己的论据。</p></div><div className="flex items-center gap-3"><div className="hidden text-right sm:block"><div className="mono text-[10px] text-[hsl(var(--muted-foreground))]">MATERIALS SAVED</div><div className="serif text-2xl font-bold">{materials.length.toString().padStart(2, '0')}</div></div><button data-testid="button-scroll-library" className="action-subtle" onClick={() => { setActive('library'); document.getElementById('library')?.scrollIntoView({ behavior: 'smooth' }); }}>浏览素材 <ArrowUpRight size={14} /></button></div></div><Editor onSaved={handleSaved} editing={editing} onCancelEdit={() => setEditing(null)} settings={openAISettings} onOpenSettings={() => setSettingsOpen(true)} /><LibrarySection materials={materials} onEdit={handleEdit} onDelete={handleDelete} /></> : <LibrarySection materials={materials} onEdit={handleEdit} onDelete={handleDelete} />}
      </div>
      {settingsOpen && <SettingsPanel value={openAISettings} onSave={saveOpenAISettings} onClose={() => setSettingsOpen(false)} />}
    </Shell>
  );
}

function Router() {
  return <ErrorBoundary><Switch><Route path="/" component={Home} /><Route component={() => <div className="grid min-h-screen place-items-center text-center"><div><h1 className="serif text-3xl font-bold">找不到这一页</h1><p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">回到你的工作台继续整理。</p></div></div>} /></Switch></ErrorBoundary>;
}

function App() {
  return <TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter><Toaster /></TooltipProvider>;
}

export default App;