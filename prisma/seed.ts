import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  const adminHash = await bcrypt.hash('Admin@123', 12);
  const approverHash = await bcrypt.hash('Approver@123', 12);
  const viewerHash = await bcrypt.hash('Viewer@123', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@dms.local' },
    update: {},
    create: { email: 'admin@dms.local', passwordHash: adminHash, name: 'System Admin', role: Role.ADMIN },
  });

  const approver = await prisma.user.upsert({
    where: { email: 'approver@dms.local' },
    update: {},
    create: { email: 'approver@dms.local', passwordHash: approverHash, name: 'Finance Approver', role: Role.APPROVER },
  });

  await prisma.user.upsert({
    where: { email: 'viewer@dms.local' },
    update: {},
    create: { email: 'viewer@dms.local', passwordHash: viewerHash, name: 'Document Viewer', role: Role.VIEWER },
  });

  console.log('✅ Seed users created:');
  console.log('   admin@dms.local     / Admin@123     (ADMIN)');
  console.log('   approver@dms.local  / Approver@123  (APPROVER)');
  console.log('   viewer@dms.local    / Viewer@123    (VIEWER)');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
