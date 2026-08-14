import { Download, FileDown, FileJson, FileText, FileType2 } from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EXPORT_FORMATS, exportMaterial, type ExportFormat } from '@/lib/exporters';
import type { Material } from '@/lib/materials';

const formatIcons: Record<ExportFormat, typeof FileText> = {
  md: FileDown,
  txt: FileText,
  json: FileJson,
  docx: FileType2,
};

export function ExportMenu({
  material,
  compact = false,
  triggerTestId,
}: {
  material: Material;
  compact?: boolean;
  triggerTestId?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          data-testid={triggerTestId}
          type="button"
          aria-label="导出素材"
          className={compact ? 'rounded-md border-0 bg-transparent p-1.5 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]' : 'action-subtle'}
        >
          <Download size={compact ? 14 : 16} />
          {!compact && <span>导出</span>}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[150px]">
        {EXPORT_FORMATS.map((format) => {
          const Icon = formatIcons[format.value];
          return (
            <DropdownMenuItem key={format.value} data-testid={`export-format-${format.value}`} onSelect={() => { void exportMaterial(material, format.value); }}>
              <Icon size={15} />
              {format.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
