/**
 * reset-admin-password.js
 *
 * Finds the first ADMIN role user in the DB and resets their password.
 * Also prints their email so you know exactly which account to log in with.
 *
 * Run in Railway shell: node reset-admin-password.js
 */

'use strict';

try { require('dotenv').config(); } catch (_) {}

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

// The new password to set
const NEW_PASSWORD = process.env.ADMIN_PASSWORD || 'L9aS2YKsCUojCp83';

async function main() {
  // List ALL users with ADMIN role so we can see what exists
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN' },
    select: { id: true, email: true, role: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  if (admins.length === 0) {
    console.log('[reset-admin] ⚠️  No ADMIN users found in the database!');
    console.log('[reset-admin] Creating one now...');

    const hashed = await bcrypt.hash(NEW_PASSWORD, 10);
    const admin = await prisma.user.create({
      data: {
        email: process.env.ADMIN_EMAIL || 'admin@hopkinsfoundationco.org',
        password: hashed,
        firstName: 'Admin',
        lastName: 'User',
        role: 'ADMIN',
        isEmailVerified: true,
      },
      select: { id: true, email: true },
    });

    console.log('[reset-admin] ✅ Admin created:', admin.email);
    console.log('[reset-admin] Password:', NEW_PASSWORD);
    return;
  }

  console.log(`[reset-admin] Found ${admins.length} admin account(s):`);
  admins.forEach((a, i) => console.log(`  ${i + 1}. ${a.email} (created: ${a.createdAt})`));

  // Reset ALL admin accounts to the same password
  const hashed = await bcrypt.hash(NEW_PASSWORD, 10);
  for (const admin of admins) {
    await prisma.user.update({
      where: { id: admin.id },
      data: { password: hashed, isEmailVerified: true },
    });
    console.log(`[reset-admin] ✅ Password reset for: ${admin.email}`);
  }

  console.log('\n[reset-admin] ✅ Done! Use any of the emails above with password:');
  console.log('  Password:', NEW_PASSWORD);
}

main()
  .catch((err) => {
    console.error('[reset-admin] ❌ Failed:', err?.message || err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
