const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log(' Seeding database...');

  
  const dept1 = await prisma.department.upsert({
    where: { code: 'IT' },
    update: {},
    create: { name: 'Information Technology', code: 'IT', description: 'IT Department' },
  });
  const dept2 = await prisma.department.upsert({
    where: { code: 'HR' },
    update: {},
    create: { name: 'Human Resources', code: 'HR', description: 'HR Department' },
  });
  const dept3 = await prisma.department.upsert({
    where: { code: 'FIN' },
    update: {},
    create: { name: 'Finance', code: 'FIN', description: 'Finance Department' },
  });

  const hashedPassword = await bcrypt.hash('password123', 10);

 
  const user1 = await prisma.user.upsert({
    where: { email: 'john.doe@company.com' },
    update: {},
    create: {
      name: 'John Doe',
      email: 'john.doe@company.com',
      password: hashedPassword,
      role: 'USER',
      departmentId: dept1.id,
      approvalLimit: 10000,
    },
  });

  const user2 = await prisma.user.upsert({
    where: { email: 'jane.smith@company.com' },
    update: {},
    create: {
      name: 'Jane Smith',
      email: 'jane.smith@company.com',
      password: hashedPassword,
      role: 'USER',
      departmentId: dept2.id,
      approvalLimit: 5000,
    },
  });

  const hod1 = await prisma.user.upsert({
    where: { email: 'hod1@company.com' },
    update: {},
    create: {
      name: 'Michael Scott',
      email: 'hod1@company.com',
      password: hashedPassword,
      role: 'HOD',
      departmentId: dept1.id,
      approvalLimit: 50000,
    },
  });

  const hod2 = await prisma.user.upsert({
    where: { email: 'hod2@company.com' },
    update: {},
    create: {
      name: 'David Wallace',
      email: 'hod2@company.com',
      password: hashedPassword,
      role: 'HOD',
      departmentId: dept1.id,
      approvalLimit: 200000,
    },
  });

  const finance1 = await prisma.user.upsert({
    where: { email: 'finance@company.com' },
    update: {},
    create: {
      name: 'Oscar Martinez',
      email: 'finance@company.com',
      password: hashedPassword,
      role: 'FINANCE',
      departmentId: dept3.id,
      approvalLimit: 999999,
    },
  });
  const user3= await prisma.user.upsert({
    where: { email: 'k.v.sivateja99@gmail.com' },
    update: {},
    create: {
      name: 'Siva',
      email: 'k.v.sivateja99@gmail.com',
      password: hashedPassword,
      role: 'USER',
      departmentId: dept1.id,
      approvalLimit: 10000,
    },
  });


  
  await prisma.hODHierarchy.upsert({
    where: { userId: hod1.id },
    update: {},
    create: { userId: hod1.id, departmentId: dept1.id, level: 1 },
  });

  await prisma.hODHierarchy.upsert({
    where: { userId: hod2.id },
    update: {},
    create: { userId: hod2.id, departmentId: dept1.id, level: 2 },
  });

  console.log('✅ Seed complete!');
  console.log('─────────────────────────────');
  console.log('Test Accounts (password: password123)');
  console.log('USER    → john.doe@company.com');
  console.log('USER    → jane.smith@company.com');
  console.log('HOD L1  → hod1@company.com');
  console.log('HOD L2  → hod2@company.com');
  console.log('FINANCE → finance@company.com');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());