// prisma/seed.js
//
// ─── WHAT THIS SEED BUILDS ────────────────────────────────────────────────────
//
//  Departments:  IT, HR, Finance
//
//  IT Department — 2 Hierarchies that share one common top-level manager:
//
//  Chain A — "IT Engineering Chain"  (Tharun, Manish, Ravi)
//  ┌─────────────────────────────────────────────────────┐
//  │  Level 0 – Tharun       limit=0        (requester)  │
//  │  Level 1 – Manish       limit=10,000   (approver)   │
//  │  Level 2 – Ravi         limit=100,000  (top/common) │
//  └─────────────────────────────────────────────────────┘
//
//  Chain B — "IT Operations Chain"  (Siva, Kishore, Ravi)
//  ┌─────────────────────────────────────────────────────┐
//  │  Level 0 – Siva         limit=0        (requester)  │
//  │  Level 1 – Kishore      limit=25,000   (approver)   │
//  │  Level 2 – Ravi         limit=100,000  (top/common) │
//  └─────────────────────────────────────────────────────┘
//
//  Ravi appears at Level 2 in BOTH chains — he is the shared senior approver.
//
//  ─── ELIGIBILITY EXAMPLES ────────────────────────────────────────────────────
//  Tharun raises ₹5,000   → 5,000 ≤ 0? No → needs approval
//                           eligible: Manish (10k≥5k ✓), Ravi (100k≥5k ✓)
//  Tharun raises ₹15,000  → eligible: Ravi only (Manish 10k < 15k ✗)
//  Tharun raises ₹5,000 with approvalLimit=10,000 → bypasses to Finance
//
//  Siva raises ₹20,000    → eligible: Kishore (25k≥20k ✓), Ravi (100k≥20k ✓)
//  Siva raises ₹30,000    → eligible: Ravi only (Kishore 25k < 30k ✗)
//
//  ─── FILE VISIBILITY ─────────────────────────────────────────────────────────
//  When a request is submitted with attachments, ALL eligible approvers in the
//  chain receive an ApprovalStep with isEligible=true. The manager.service
//  getManagerRequestDetails query checks isEligible=true before granting access,
//  so only eligible approvers can open the request and view its attachments.
//  Ineligible managers (LIMIT_TOO_LOW / LEVEL_TOO_LOW) get isEligible=false
//  steps — they can never reach the detail endpoint.
//
// ─── NOTE ON hierarchyLevel ───────────────────────────────────────────────────
//  User.hierarchyLevel is the denormalised copy of HierarchyStep.level for that
//  user. It MUST be set here so workflow.service.classifySteps works correctly.
//  Managers that appear in multiple chains are assigned the level from the chain
//  they "belong to" as a primary chain. Ravi has no chain of his own (he only
//  appears as the top approver) so his hierarchyLevel is set to 2 (his position
//  in both chains — same in both, so no conflict).

'use strict';

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...\n');

  // ══════════════════════════════════════════════════════════════════════════════
  // 1. DEPARTMENTS
  // ══════════════════════════════════════════════════════════════════════════════

  const deptIT = await prisma.department.upsert({
    where:  { code: 'IT' },
    update: {},
    create: { name: 'Information Technology', code: 'IT', description: 'IT Department' },
  });

  const deptHR = await prisma.department.upsert({
    where:  { code: 'HR' },
    update: {},
    create: { name: 'Human Resources', code: 'HR', description: 'HR Department' },
  });

  const deptFIN = await prisma.department.upsert({
    where:  { code: 'FIN' },
    update: {},
    create: { name: 'Finance', code: 'FIN', description: 'Finance Department' },
  });

  console.log('✅ Departments created');

  // ══════════════════════════════════════════════════════════════════════════════
  // 2. USERS (created before hierarchies so we have IDs for HierarchyStep)
  //
  //  We create all users with approvalHierarchyId=null first.
  //  hierarchyLevel is set after hierarchy creation in a second pass.
  // ══════════════════════════════════════════════════════════════════════════════

  // ── Requesters (level 0 in their chains) ──────────────────────────────────
  // approvalLimit=0 → can only raise requests, cannot approve (Req 1)

  const tharun = await prisma.user.upsert({
    where:  { email: 'tharun@company.com' },
    update: { name: 'Tharun', approvalLimit: 0, role: 'USER', departmentId: deptIT.id },
    create: {
      name:         'Tharun',
      email:        'tharun@company.com',
      role:         'USER',
      departmentId: deptIT.id,
      approvalLimit: 0,
      // approvalHierarchyId set later
    },
  });

  const siva = await prisma.user.upsert({
    where:  { email: 'siva@company.com' },
    update: { name: 'Siva', approvalLimit: 0, role: 'USER', departmentId: deptIT.id },
    create: {
      name:         'Siva',
      email:        'siva@company.com',
      role:         'USER',
      departmentId: deptIT.id,
      approvalLimit: 0,
    },
  });

  // ── Chain A mid-level approver ─────────────────────────────────────────────
  // Manish: Level 1 in Chain A, limit=10,000
  // Can approve requests up to ₹10,000 that come from level < 1 in his chain.

  const manish = await prisma.user.upsert({
    where:  { email: 'manish@company.com' },
    update: { name: 'Manish', approvalLimit: 10000, role: 'MANAGER', departmentId: deptIT.id },
    create: {
      name:         'Manish',
      email:        'manish@company.com',
      role:         'MANAGER',
      departmentId: deptIT.id,
      approvalLimit: 10000,
    },
  });

  // ── Chain B mid-level approver ─────────────────────────────────────────────
  // Kishore: Level 1 in Chain B, limit=25,000

  const kishore = await prisma.user.upsert({
    where:  { email: 'kishore@company.com' },
    update: { name: 'Kishore', approvalLimit: 25000, role: 'MANAGER', departmentId: deptIT.id },
    create: {
      name:         'Kishore',
      email:        'kishore@company.com',
      role:         'MANAGER',
      departmentId: deptIT.id,
      approvalLimit: 25000,
    },
  });

  // ── Shared top-level approver (common to BOTH chains) ─────────────────────
  // Ravi: Level 2 in both Chain A and Chain B, limit=100,000
  // Because he is a top approver only (not a requester in any chain),
  // we don't assign him a primary approvalHierarchyId — it stays null.
  // His hierarchyLevel is 2 (same in both chains).

  const ravi = await prisma.user.upsert({
    where:  { email: 'ravi@company.com' },
    update: { name: 'Ravi', approvalLimit: 100000, role: 'MANAGER', departmentId: deptIT.id },
    create: {
      name:         'Ravi',
      email:        'ravi@company.com',
      role:         'MANAGER',
      departmentId: deptIT.id,
      approvalLimit: 100000,
      // No approvalHierarchyId — he doesn't submit requests himself
    },
  });

  // ── Finance user ──────────────────────────────────────────────────────────

  const financeUser = await prisma.user.upsert({
    where:  { email: 'finance@company.com' },
    update: {},
    create: {
      name:         'Oscar Martinez',
      email:        'finance@company.com',
      role:         'FINANCE',
      departmentId: deptFIN.id,
      approvalLimit: 0,   // Finance role — limit irrelevant, kept 0
    },
  });

  // ── HR user (no hierarchy — goes direct to Finance) ───────────────────────

  const hrUser = await prisma.user.upsert({
    where:  { email: 'jane@company.com' },
    update: {},
    create: {
      name:         'Jane Smith',
      email:        'jane@company.com',
      role:         'USER',
      departmentId: deptHR.id,
      approvalLimit: 5000,
      // No approvalHierarchyId → requests go straight to Finance
    },
  });

  console.log('✅ Users created');

  // ══════════════════════════════════════════════════════════════════════════════
  // 3. APPROVAL HIERARCHIES (two in IT dept)
  // ══════════════════════════════════════════════════════════════════════════════

  // ── Chain A: IT Engineering ────────────────────────────────────────────────
  let chainA = await prisma.approvalHierarchy.findFirst({
    where: { name: 'IT Engineering Chain', departmentId: deptIT.id },
  });
  if (!chainA) {
    chainA = await prisma.approvalHierarchy.create({
      data: {
        departmentId: deptIT.id,
        name:         'IT Engineering Chain',
        description:  'Tharun → Manish (L1) → Ravi (L2)',
        isActive:     true,
      },
    });
  }

  // ── Chain B: IT Operations ─────────────────────────────────────────────────
  let chainB = await prisma.approvalHierarchy.findFirst({
    where: { name: 'IT Operations Chain', departmentId: deptIT.id },
  });
  if (!chainB) {
    chainB = await prisma.approvalHierarchy.create({
      data: {
        departmentId: deptIT.id,
        name:         'IT Operations Chain',
        description:  'Siva → Kishore (L1) → Ravi (L2)',
        isActive:     true,
      },
    });
  }

  console.log('✅ Hierarchies created');

  // ══════════════════════════════════════════════════════════════════════════════
  // 4. HIERARCHY STEPS
  //    approvalLimitSnapshot is stored here so eligibility checks remain stable
  //    even if an admin later changes a manager's User.approvalLimit.
  // ══════════════════════════════════════════════════════════════════════════════

  // ─── Chain A steps ────────────────────────────────────────────────────────
  //   Level 1 → Manish  (limit snapshot: 10,000)
  //   Level 2 → Ravi    (limit snapshot: 100,000)
  //
  // NOTE: @@unique([hierarchyId, approverId]) means Ravi can only appear ONCE
  // per hierarchy — he gets his own entry in each chain separately, which is
  // correct because the two HierarchyStep rows belong to different hierarchies.

  await prisma.hierarchyStep.upsert({
    where:  { hierarchyId_level: { hierarchyId: chainA.id, level: 1 } },
    update: { approverId: manish.id, approvalLimitSnapshot: 10000 },
    create: {
      hierarchyId:           chainA.id,
      level:                 1,
      approverId:            manish.id,
      approvalLimitSnapshot: 10000,
    },
  });

  await prisma.hierarchyStep.upsert({
    where:  { hierarchyId_level: { hierarchyId: chainA.id, level: 2 } },
    update: { approverId: ravi.id, approvalLimitSnapshot: 100000 },
    create: {
      hierarchyId:           chainA.id,
      level:                 2,
      approverId:            ravi.id,
      approvalLimitSnapshot: 100000,
    },
  });

  // ─── Chain B steps ────────────────────────────────────────────────────────
  //   Level 1 → Kishore (limit snapshot: 25,000)
  //   Level 2 → Ravi    (limit snapshot: 100,000)

  await prisma.hierarchyStep.upsert({
    where:  { hierarchyId_level: { hierarchyId: chainB.id, level: 1 } },
    update: { approverId: kishore.id, approvalLimitSnapshot: 25000 },
    create: {
      hierarchyId:           chainB.id,
      level:                 1,
      approverId:            kishore.id,
      approvalLimitSnapshot: 25000,
    },
  });

  await prisma.hierarchyStep.upsert({
    where:  { hierarchyId_level: { hierarchyId: chainB.id, level: 2 } },
    update: { approverId: ravi.id, approvalLimitSnapshot: 100000 },
    create: {
      hierarchyId:           chainB.id,
      level:                 2,
      approverId:            ravi.id,
      approvalLimitSnapshot: 100000,
    },
  });

  console.log('✅ Hierarchy steps created');

  // ══════════════════════════════════════════════════════════════════════════════
  // 5. ASSIGN HIERARCHY + hierarchyLevel TO EACH USER
  //
  //    hierarchyLevel = the user's level WITHIN their assigned hierarchy.
  //    This is the denormalised field workflow.service reads via
  //    creator.hierarchyLevel — must match the HierarchyStep.level exactly.
  //
  //    Tharun  → Chain A, level 0 (requester — no HierarchyStep row needed)
  //    Manish  → Chain A, level 1
  //    Siva    → Chain B, level 0 (requester)
  //    Kishore → Chain B, level 1
  //    Ravi    → No primary chain, level 2 (same in both; no requests raised)
  // ══════════════════════════════════════════════════════════════════════════════

  await prisma.user.update({
    where: { id: tharun.id },
    data:  { approvalHierarchyId: chainA.id, hierarchyLevel: 0 },
  });

  await prisma.user.update({
    where: { id: manish.id },
    data:  { approvalHierarchyId: chainA.id, hierarchyLevel: 1 },
  });

  await prisma.user.update({
    where: { id: siva.id },
    data:  { approvalHierarchyId: chainB.id, hierarchyLevel: 0 },
  });

  await prisma.user.update({
    where: { id: kishore.id },
    data:  { approvalHierarchyId: chainB.id, hierarchyLevel: 1 },
  });

  // Ravi: no primary chain assigned (he never submits requests).
  // hierarchyLevel=2 reflects his position in both chains.
  await prisma.user.update({
    where: { id: ravi.id },
    data:  { approvalHierarchyId: null, hierarchyLevel: 2 },
  });

  console.log('✅ User hierarchy assignments updated');

  // ══════════════════════════════════════════════════════════════════════════════
  // 6. SUMMARY
  // ══════════════════════════════════════════════════════════════════════════════

  console.log(`
╔══════════════════════════════════════════════════════════════════╗
║                     SEED COMPLETED SUCCESSFULLY                  ║
╠══════════════════════════════════════════════════════════════════╣
║  DEPARTMENTS                                                     ║
║  IT  (id=${String(deptIT.id).padEnd(2)})  HR  (id=${String(deptHR.id).padEnd(2)})  Finance  (id=${String(deptFIN.id).padEnd(2)})         ║
╠══════════════════════════════════════════════════════════════════╣
║  CHAIN A — IT Engineering Chain  (id=${String(chainA.id).padEnd(2)})                 ║
║  Level 0  Tharun    limit=0        USER     (requester)         ║
║  Level 1  Manish    limit=10,000   MANAGER  (approver)          ║
║  Level 2  Ravi      limit=100,000  MANAGER  (top/shared)        ║
╠══════════════════════════════════════════════════════════════════╣
║  CHAIN B — IT Operations Chain   (id=${String(chainB.id).padEnd(2)})                 ║
║  Level 0  Siva      limit=0        USER     (requester)         ║
║  Level 1  Kishore   limit=25,000   MANAGER  (approver)          ║
║  Level 2  Ravi      limit=100,000  MANAGER  (top/shared)        ║
╠══════════════════════════════════════════════════════════════════╣
║  OTHER USERS                                                     ║
║  Jane     HR dept, no hierarchy → requests bypass to Finance    ║
║  Oscar    Finance role                                           ║
╠══════════════════════════════════════════════════════════════════╣
║  ELIGIBILITY QUICK-REFERENCE                                     ║
║  Tharun raises ₹5,000  → Manish ✓  Ravi ✓                      ║
║  Tharun raises ₹15,000 → Manish ✗ (limit too low)  Ravi ✓      ║
║  Siva   raises ₹20,000 → Kishore ✓  Ravi ✓                     ║
║  Siva   raises ₹30,000 → Kishore ✗ (limit too low)  Ravi ✓     ║
║  Either approves → request moves to Finance immediately         ║
╠══════════════════════════════════════════════════════════════════╣
║  FILE VISIBILITY                                                 ║
║  Eligible approvers (isEligible=true) → can open request + files║
║  Ineligible managers                  → ApprovalStep hidden     ║
╚══════════════════════════════════════════════════════════════════╝
`);
}

main()
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });