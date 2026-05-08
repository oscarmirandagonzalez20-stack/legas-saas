import type { Metadata } from 'next';
import type { LeadStage } from '@/lib/api/types';
import { getServerAuth } from '@/auth/server';
import { listLeads } from '@/lib/api/leads';
import { LeadsTable } from '@/components/leads/leads-table';
import { LeadsFilters } from '@/components/leads/leads-filters';

export const metadata: Metadata = { title: 'Leads — Legal SaaS' };

interface PageProps {
  searchParams: Promise<{
    search?: string;
    stage?: string;
    page?: string;
  }>;
}

export default async function LeadsPage({ searchParams }: PageProps) {
  const auth = await getServerAuth();
  const token = await auth.getToken();
  const params = await searchParams;

  const stage = params.stage as LeadStage | undefined;
  const page = Number(params.page ?? '1');

  let result = await listLeads(token, { search: params.search, stage, page, limit: 20 }).catch(
    () => ({ data: [], total: 0, page: 1, pages: 1 }),
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Leads</h1>
        <p className="text-sm text-muted-foreground">
          Prospectos detectados en comentarios de Facebook e Instagram.
        </p>
      </div>

      <LeadsFilters currentSearch={params.search} currentStage={stage} />

      <LeadsTable result={result} currentPage={page} />
    </div>
  );
}
