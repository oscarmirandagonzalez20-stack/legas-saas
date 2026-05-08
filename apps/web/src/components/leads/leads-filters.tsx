'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { LeadStage } from '@/lib/api/types';

const STAGES: { value: LeadStage; label: string }[] = [
  { value: 'NEW', label: 'Nuevo' },
  { value: 'CONTACTED', label: 'Contactado' },
  { value: 'WHATSAPP_INITIATED', label: 'WhatsApp' },
  { value: 'CONSULTATION_SCHEDULED', label: 'Cita agendada' },
  { value: 'CONSULTATION_PAID', label: 'Cita pagada' },
  { value: 'CLIENT', label: 'Cliente' },
  { value: 'LOST', label: 'Perdido' },
];

interface LeadsFiltersProps {
  currentSearch?: string;
  currentStage?: LeadStage;
}

export function LeadsFilters({ currentSearch, currentStage }: LeadsFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const updateParams = useCallback(
    (updates: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete('page'); // reset page on filter change
      for (const [key, value] of Object.entries(updates)) {
        if (value) params.set(key, value);
        else params.delete(key);
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams],
  );

  const hasFilters = !!currentSearch || !!currentStage;

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative w-full max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre o ID externo…"
          defaultValue={currentSearch}
          className="pl-9"
          onChange={(e) => {
            const val = e.target.value;
            const timeout = setTimeout(() => updateParams({ search: val || undefined }), 400);
            return () => clearTimeout(timeout);
          }}
        />
      </div>

      {/* Stage quick filters */}
      <div className="flex flex-wrap gap-1.5">
        {STAGES.map((s) => (
          <button
            key={s.value}
            onClick={() =>
              updateParams({ stage: currentStage === s.value ? undefined : s.value })
            }
            className="focus:outline-none"
          >
            <Badge
              variant={currentStage === s.value ? 'default' : 'outline'}
              className="cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              {s.label}
            </Badge>
          </button>
        ))}

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-muted-foreground"
            onClick={() => updateParams({ search: undefined, stage: undefined })}
          >
            <X className="h-3 w-3 mr-1" />
            Limpiar
          </Button>
        )}
      </div>
    </div>
  );
}
