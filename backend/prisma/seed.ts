import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  const reviewerPassword = process.env.SEED_REVIEWER_PASSWORD;

  if (!adminPassword || !reviewerPassword) {
    throw new Error(
      'SEED_ADMIN_PASSWORD and SEED_REVIEWER_PASSWORD must be set in environment variables',
    );
  }

  const adminHash = await argon2.hash(adminPassword);
  const reviewerHash = await argon2.hash(reviewerPassword);

  // Upsert admin user
  await prisma.user.upsert({
    where: { email: 'admin@scientificguard.local' },
    update: {},
    create: {
      name: 'Admin User',
      email: 'admin@scientificguard.local',
      passwordHash: adminHash,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    },
  });

  // Upsert reviewer user
  await prisma.user.upsert({
    where: { email: 'reviewer@scientificguard.local' },
    update: {},
    create: {
      name: 'Luis Reviewer',
      email: 'reviewer@scientificguard.local',
      passwordHash: reviewerHash,
      role: UserRole.REVIEWER,
      status: UserStatus.ACTIVE,
    },
  });

  console.log('Seed completed: admin and reviewer users created.');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
