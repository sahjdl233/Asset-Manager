import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { useAnalyzeMaterial, type CategoryRef, type MaterialAnalysis } from '@workspace/api-client-react';
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
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { makeMaterial, readMaterials, toMarkdown, writeMaterials, type Material } from '@/lib/materials';
import categories from '@/data/categories.json';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Route, Switch, Router as WouterRouter } from 'wouter';

const queryClient = new QueryClient();
type CategoryNode = (typeof categories.dimensions)[number];
type ThemeNode = CategoryNode['themes'][number];

const starterContent = `今年以来，多地持续探索“社区食堂”服务模式。上海市杨浦区将闲置空间改造成老年助餐点，引入社会力量参与运营，既解决了独居老人“吃饭难”，也让社区里的年轻人有了更便利的就餐选择。食堂不只提供一餐饭，还通过志愿服务、健康咨询等活动，把分散的居民重新组织起来。`;

const normalizeCategory = (input: CategoryRef | undefined): CategoryRef => {
  const dimension = categories.dimensions.find((item) => item.id === input?.dimension.id || item.name === input?.dimension.name) ?? categories.dimensions[0];
  const theme = dimension.themes.find((item) => item.id === input?.theme.id || item.name === input?.theme.name) ?? dimension.themes[0];
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

function Shell({ children, active, onNavigate }: { children: ReactNode; active: 'desk' | 'library'; onNavigate: (view: 'desk' | 'library') => void }) {
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

function Topbar({ active, onNavigate, count }: { active: 'desk' | 'library'; onNavigate: (view: 'desk' | 'library') => void; count: number }) {
  return (
    <header className="topbar">
      <div className="flex items-center gap-3">
        <BookOpen size={18} className="text-[hsl(var(--primary))]" strokeWidth={1.8} />
        <span className="text-sm font-semibold">{active === 'desk' ? '工作台' : '我的素材'}</span>
        <span className="hidden text-xs text-[hsl(var(--muted-foreground))] sm:inline">/ {count} 条已保存</span>
      </div>
      <button data-testid="button-new-material-top" className="action-primary py-2 text-xs" onClick={() => onNavigate('desk')}>
        <Plus size={15} /> 新建素材
      </button>
    </header>
  );
}

function CategoryEditor({ value, onChange }: { value: CategoryRef; onChange: (value: CategoryRef) => void }) {
  const dimension = categories.dimensions.find((item) => item.id === value.dimension.id) ?? categories.dimensions[0];
  const theme = dimension.themes.find((item) => item.id === value.theme.id) ?? dimension.themes[0];
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <label>
        <span className="field-label">维度</span>
        <span className="relative block">
          <select data-testid="select-category-dimension" className="select-input appearance-none px-3 py-2.5 text-sm" value={dimension.id} onChange={(event) => {
            const next = categories.dimensions.find((item) => item.id === event.target.value) ?? categories.dimensions[0];
            const nextTheme = next.themes[0];
            onChange({ dimension: { id: next.id, name: next.name }, theme: { id: nextTheme.id, name: nextTheme.name }, direction: { id: nextTheme.directions[0].id, name: nextTheme.directions[0].name } });
          }}>
            {categories.dimensions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select><ChevronDown size={15} className="pointer-events-none absolute right-3 top-3 text-[hsl(var(--muted-foreground))]" />
        </span>
      </label>
      <label>
        <span className="field-label">主题</span>
        <span className="relative block">
          <select data-testid="select-category-theme" className="select-input appearance-none px-3 py-2.5 text-sm" value={theme.id} onChange={(event) => {
            const nextTheme = dimension.themes.find((item) => item.id === event.target.value) ?? dimension.themes[0];
            onChange({ dimension: { id: dimension.id, name: dimension.name }, theme: { id: nextTheme.id, name: nextTheme.name }, direction: { id: nextTheme.directions[0].id, name: nextTheme.directions[0].name } });
          }}>
            {dimension.themes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
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
        <div className="field-label">关键词 <span className="font-normal tracking-normal text-[hsl(var(--muted-foreground)/.7)]">· 回车添加</span></div>
        <TagInput value={analysis.keywords} onChange={(value) => update('keywords', value)} placeholder="例如：社区食堂" />
      </div>
      <div>
        <div className="field-label">论据类型 <span className="font-normal tracking-normal text-[hsl(var(--muted-foreground)/.7)]">· 可多选</span></div>
        <div className="flex flex-wrap gap-2">
          {categories.argument_types.map((item) => {
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

function Editor({ onSaved, editing, onCancelEdit }: { onSaved: (material: Material) => void; editing: Material | null; onCancelEdit: () => void }) {
  const [content, setContent] = useState(editing?.content ?? '');
  const [source, setSource] = useState(editing?.source ?? '');
  const [analysis, setAnalysis] = useState<MaterialAnalysis | null>(editing ? { ...editing } : null);
  const [saveState, setSaveState] = useState<'idle' | 'saved'>('idle');
  const analyze = useAnalyzeMaterial();

  useEffect(() => {
    setContent(editing?.content ?? '');
    setSource(editing?.source ?? '');
    setAnalysis(editing ? { ...editing } : null);
    setSaveState('idle');
  }, [editing]);

  const handleAnalyze = () => {
    if (content.trim().length < 20) return;
    analyze.mutate({ data: { content: content.trim() } }, { onSuccess: (result) => setAnalysis(normalizeAnalysis(result)) });
  };
  const handleSave = () => {
    if (!analysis || !content.trim()) return;
    const material = editing ? { ...editing, ...analysis, content: content.trim(), source: source.trim() || '个人摘录', updated_at: new Date().toISOString() } : makeMaterial(analysis, content.trim(), source.trim() || '个人摘录');
    onSaved(material);
    setSaveState('saved');
    window.setTimeout(() => setSaveState('idle'), 2200);
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
            <button data-testid="button-analyze-material" className="action-primary" disabled={content.trim().length < 20 || analyze.isPending} onClick={handleAnalyze}>{analyze.isPending ? <><span className="pulse-soft"><Sparkles size={16} /></span> 分析中…</> : <><Sparkles size={16} /> AI 分析</>}</button>
          </div>
          {content.trim().length > 0 && content.trim().length < 20 && <div className="mt-3 flex items-center gap-2 text-xs text-[hsl(var(--accent))]"><AlertCircle size={14} />再多写一点，至少 20 个字</div>}
          {analyze.isError && <div data-testid="status-analysis-error" className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-[hsl(var(--destructive)/.3)] bg-[hsl(var(--destructive)/.06)] px-3 py-2.5 text-xs text-[hsl(var(--destructive))]"><span className="flex items-center gap-2"><AlertCircle size={14} />分析没有完成，请稍后重试</span><button data-testid="button-retry-analysis" className="font-bold underline" onClick={handleAnalyze}>重试</button></div>}
        </div>
      </div>
      <div className="paper analysis-panel">
        <div className="paper-header">
          <div className="flex items-center gap-2.5"><div className="grid h-7 w-7 place-items-center rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"><Sparkles size={15} /></div><div><div className="text-sm font-semibold">AI 分析草稿</div><div className="text-[11px] text-[hsl(var(--muted-foreground))]">每一项都可以改，决定权在你</div></div></div>
          {analysis && <span className="chip chip-warm text-[10px]"><PenLine size={11} />可编辑</span>}
        </div>
        {analyze.isPending ? <AnalysisSkeleton /> : analysis ? <div className="paper-body"><AnalysisForm analysis={analysis} setAnalysis={setAnalysis} /><div className="mt-7 flex flex-wrap justify-end gap-2 border-t border-[hsl(var(--border))] pt-5">{editing && <button data-testid="button-cancel-edit" className="action-subtle" onClick={onCancelEdit}>取消编辑</button>}<button data-testid="button-save-material" className="action-primary" onClick={handleSave} disabled={!analysis.title.trim()}>{saveState === 'saved' ? <><Check size={16} />已保存</> : <><Download size={16} />保存到素材库</>}</button></div></div> : <EmptyAnalysis />}
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
  const exportMaterial = (material: Material) => {
    const blob = new Blob([toMarkdown(material)], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = `${material.title || '申论素材'}.md`; anchor.click(); URL.revokeObjectURL(url);
  };
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
      {filtered.length === 0 ? <div data-testid="empty-library" className="paper flex min-h-[255px] flex-col items-center justify-center text-center"><div className="mb-4 grid h-12 w-12 place-items-center rounded-full border border-dashed border-[hsl(var(--primary)/.4)] text-[hsl(var(--primary))]"><Library size={21} strokeWidth={1.5} /></div><div className="serif font-semibold">{materials.length === 0 ? '你的素材库还空着' : '没有找到这条素材'}</div><p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">{materials.length === 0 ? '从上面贴一段新闻，给下一次写作留一盏灯。' : '试试换一个关键词，或清除筛选条件。'}</p></div> : <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">{filtered.map((material) => <MaterialCard key={material.id} material={material} onEdit={() => onEdit(material)} onDelete={() => onDelete(material.id)} onExport={() => exportMaterial(material)} />)}</div>}
    </section>
  );
}

function Home() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [active, setActive] = useState<'desk' | 'library'>('desk');
  const [editing, setEditing] = useState<Material | null>(null);
  useEffect(() => setMaterials(readMaterials()), []);
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
    <Shell active={active} onNavigate={(view) => { setActive(view); if (view === 'library') window.setTimeout(() => document.getElementById('library')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 40); }}>
      <Topbar active={active} onNavigate={(view) => { setActive(view); if (view === 'desk') window.scrollTo({ top: 0, behavior: 'smooth' }); }} count={materials.length} />
      <div className="content-wrap">
        {active === 'desk' ? <><div className="mb-9 flex flex-wrap items-end justify-between gap-5 rise-in"><div><div className="eyebrow">A QUIET PLACE TO THINK</div><h1 data-testid="text-workspace-title" className="headline mt-3 max-w-[650px] text-4xl font-bold sm:text-5xl">把看见的，<br /><span className="text-[hsl(var(--primary))]">变成能写的。</span></h1><p className="mt-4 max-w-[490px] text-sm leading-6 text-[hsl(var(--muted-foreground))]">粘贴一段新闻、政策或案例。AI 负责拆解，你负责判断。每一次编辑，都是把别人的故事变成自己的论据。</p></div><div className="flex items-center gap-3"><div className="hidden text-right sm:block"><div className="mono text-[10px] text-[hsl(var(--muted-foreground))]">MATERIALS SAVED</div><div className="serif text-2xl font-bold">{materials.length.toString().padStart(2, '0')}</div></div><button data-testid="button-scroll-library" className="action-subtle" onClick={() => { setActive('library'); document.getElementById('library')?.scrollIntoView({ behavior: 'smooth' }); }}>浏览素材 <ArrowUpRight size={14} /></button></div></div><Editor onSaved={handleSaved} editing={editing} onCancelEdit={() => setEditing(null)} /><LibrarySection materials={materials} onEdit={handleEdit} onDelete={handleDelete} /></> : <LibrarySection materials={materials} onEdit={handleEdit} onDelete={handleDelete} />}
      </div>
    </Shell>
  );
}

function Router() {
  return <ErrorBoundary><Switch><Route path="/" component={Home} /><Route component={() => <div className="grid min-h-screen place-items-center text-center"><div><h1 className="serif text-3xl font-bold">找不到这一页</h1><p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">回到你的工作台继续整理。</p></div></div>} /></Switch></ErrorBoundary>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;