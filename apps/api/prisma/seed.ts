/**
 * Demo seed — creates a stable tenant + user + demo leads.
 *
 * Idempotent: safe to run multiple times (upsert / skipDuplicates).
 * Requires: DATABASE_URL (and DATABASE_URL_DIRECT if using Prisma Accelerate).
 *
 * Run: pnpm db:seed
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Fixed IDs — stable across runs so re-seeding never creates duplicates.
const TENANT_ID = 'a0000000-0000-0000-0000-000000000001';
const USER_ID   = 'a0000000-0000-0000-0000-000000000002';

// Demo leads that make the dashboard non-empty and show realistic legal data.
const DEMO_LEADS = [
  {
    id: 'c0000000-0000-0000-0000-000000000001',
    externalUserId: 'demo_fb_user_001',
    displayName: 'María González',
    areaLegal: 'FAMILIA',
    stage: 'NEW' as const,
    tags: ['divorcio', 'urgente'],
    notes: 'Comentó en post de divorcio express: "¿Cuánto cobran? Necesito uno rápido."',
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2h ago
  },
  {
    id: 'c0000000-0000-0000-0000-000000000002',
    externalUserId: 'demo_fb_user_002',
    displayName: 'Carlos Herrera',
    areaLegal: 'MERCANTIL',
    stage: 'CONTACTED' as const,
    tags: ['empresa', 'cierre'],
    notes: 'Comentó en post de empresas: "Necesito cerrar mi empresa, ¿me pueden ayudar?"',
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5h ago
  },
  {
    id: 'c0000000-0000-0000-0000-000000000003',
    externalUserId: 'demo_fb_user_003',
    displayName: 'Roberto Martínez',
    areaLegal: 'PENAL',
    stage: 'NEW' as const,
    tags: ['penal', 'defensa'],
    notes: 'Comentó en post de defensa penal: "Me acusan injustamente, ¿qué hago?"',
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1d ago
  },
  {
    id: 'c0000000-0000-0000-0000-000000000004',
    externalUserId: 'demo_ig_user_001',
    displayName: 'Ana López',
    areaLegal: 'LABORAL',
    stage: 'NEW' as const,
    tags: ['despido', 'liquidación'],
    notes: 'Comentó en post de IG: "Me corrieron sin darme mi liquidación, ¿pueden ayudarme?"',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2d ago
  },
  {
    id: 'c0000000-0000-0000-0000-000000000005',
    externalUserId: 'demo_fb_user_004',
    displayName: 'Luis Ramírez',
    areaLegal: 'FISCAL',
    stage: 'CONSULTATION_SCHEDULED' as const,
    tags: ['sat', 'fiscal'],
    notes: 'Comentó: "El SAT me mandó una auditoría, ¿qué hago?"',
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3d ago
  },
] as const;

async function main(): Promise<void> {
  console.log('Seeding demo data…');

  // ── 1. Tenant (no RLS — tenants table has no tenant_id) ──────────────────────
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'demo-despacho' },
    create: {
      id: TENANT_ID,
      slug: 'demo-despacho',
      name: 'Demo Despacho Jurídico',
      subscriptionPlan: 'STARTER',
    },
    update: { name: 'Demo Despacho Jurídico' },
  });
  console.log(`  ✓ Tenant: ${tenant.name} (${tenant.id})`);

  // ── 2. User (no RLS — users table has no tenant_id) ──────────────────────────
  const user = await prisma.user.upsert({
    where: { email: 'demo@demo-despacho.com' },
    create: {
      id: USER_ID,
      email: 'demo@demo-despacho.com',
      fullName: 'Abog. Demo',
    },
    update: {},
  });
  console.log(`  ✓ User: ${user.fullName} (${user.email})`);

  // ── 3. RLS-protected tables — all in one transaction ─────────────────────────
  // set_config(..., true) is equivalent to SET LOCAL: scoped to this transaction.
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${TENANT_ID}, true)`;

    // Membership
    await tx.membership.upsert({
      where: { userId_tenantId: { userId: user.id, tenantId: tenant.id } },
      create: { userId: user.id, tenantId: tenant.id, role: 'OWNER' },
      update: {},
    });
    console.log(`  ✓ Membership: ${user.email} → OWNER of ${tenant.slug}`);

    // Demo leads
    const { count } = await tx.lead.createMany({
      data: DEMO_LEADS.map((l) => ({
        ...l,
        tenantId: TENANT_ID,
        stageChangedAt: l.createdAt,
        tags: [...l.tags],
      })),
      skipDuplicates: true,
    });
    console.log(`  ✓ Leads: ${String(count)} created (${String(DEMO_LEADS.length - count)} already existed)`);
  });

  console.log('\nSeed complete.');
  console.log(`\nDemo credentials:`);
  console.log(`  Tenant slug : demo-despacho`);
  console.log(`  User email  : demo@demo-despacho.com`);
  console.log(`  Clerk login : configure via Clerk dashboard (email = demo@demo-despacho.com)`);
}

main()
  .catch((err: unknown) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
