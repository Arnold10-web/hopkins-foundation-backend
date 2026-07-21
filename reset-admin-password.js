/**
 * reset-admin-password.js
 *
 * One-time utility to reset the admin password OR create the admin if missing.
 * Run this in Railway shell: node reset-admin-password.js
 *
 * Reads from env vars (set in Railway dashboard):
 *   ADMIN_EMAIL    - the admin email address
 *   ADMIN_PASSWORD - the desired admin password
 */

'use strict';

try { require('dotenv').config(); } catch (_) {}

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const ADMIN_EMAIL    = process.env.ADMIN_EMAIL    || 'admin@hopkinsfoundation.org';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'L9aS2YKsCUojCp83';

async function main() {
  console.log('[reset-admin] Looking for admin user:', ADMIN_EMAIL);

  const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);

  // Try to find existing user by email
  const existingUser = await prisma.user.findFirst({
    where: { email: { equals: ADMIN_EMAIL, mode: 'insensitive' } },
  });

  if (existingUser) {
    // Update the existing user's password and ensure role is ADMIN
    await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        password: hashedPassword,
        role: 'ADMIN',
        isEmailVerified: true,
      },
    });
    console.log('[reset-admin] ✅ Password reset for:', existingUser.email, '| Role set to ADMIN');
  } else {
    // Create a fresh admin
    const admin = await prisma.user.create({
      data: {
        email: ADMIN_EMAIL,
        password: hashedPassword,
        firstName: 'Admin',
        lastName: 'User',
        role: 'ADMIN',
        isEmailVerified: true,
      },
      select: { id: true, email: true, role: true },
    });
    console.log('[reset-admin] ✅ Admin created:', admin.email);
  }

  console.log('[reset-admin] Done. You can now log in with:');
  console.log('  Email:   ', ADMIN_EMAIL);
  console.log('  Password:', ADMIN_PASSWORD);
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
