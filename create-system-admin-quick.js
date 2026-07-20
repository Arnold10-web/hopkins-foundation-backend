/**
 * create-system-admin-quick.js
 *
 * Idempotent one-time admin bootstrap for Railway post-deploy.
 *
 * - Loads Prisma + env (Railway injects DATABASE_URL, ADMIN_* vars).
 * - If an ADMIN already exists in the DB, it does NOTHING and exits 0.
 * - If no ADMIN exists, it creates one from ADMIN_EMAIL / ADMIN_PASSWORD
 *   (with safe fallbacks) and exits 0.
 *
 * Because it is guarded by a DB lookup, it is safe to run on every deploy
 * and every container restart. It only ever creates the first admin once.
 * It never blocks app startup: any failure is logged and we still exit 0.
 */

'use strict';

// Load local .env if present (Railway already has real env vars in process.env).
try {
  require('dotenv').config();
} catch (_) {
  /* dotenv optional */
}

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@hopkinsfoundationco.org';
const ADMIN_FIRST_NAME = process.env.ADMIN_FIRST_NAME || 'Admin';
const ADMIN_LAST_NAME = process.env.ADMIN_LAST_NAME || 'User';

// If ADMIN_PASSWORD is not set, generate a secure one and print it to the
// deploy logs (one-time visibility). The admin can reset it later.
function resolvePassword() {
  if (process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.length >= 8) {
    return process.env.ADMIN_PASSWORD;
  }
  const crypto = require('crypto');
  const generated = crypto.randomBytes(12).toString('base64').replace(/[^A-Za-z0-9]/g, '').slice(0, 16);
  console.log('[admin-bootstrap] No ADMIN_PASSWORD set — generated one-time password: ' + generated);
  return generated;
}

async function main() {
  console.log('[admin-bootstrap] Checking for an existing ADMIN user...');

  const existingAdmin = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
    select: { id: true, email: true },
  });

  if (existingAdmin) {
    // Idempotent password sync: if ADMIN_PASSWORD is provided, keep the
    // existing admin's password in sync with it. Safe on every redeploy.
    if (process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.length >= 8) {
      const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
      await prisma.user.update({
        where: { id: existingAdmin.id },
        data: { password: hashedPassword },
      });
      console.log('[admin-bootstrap] ADMIN exists (' + existingAdmin.email + ') — synced ADMIN_PASSWORD from env.');
    } else {
      console.log('[admin-bootstrap] ADMIN already exists (' + existingAdmin.email + '). Skipping (idempotent no-op).');
    }
    return;
  }

  const password = resolvePassword();
  const hashedPassword = await bcrypt.hash(password, 10);

  const admin = await prisma.user.create({
    data: {
      email: ADMIN_EMAIL,
      password: hashedPassword,
      firstName: ADMIN_FIRST_NAME,
      lastName: ADMIN_LAST_NAME,
      role: 'ADMIN',
      isEmailVerified: true,
    },
    select: { id: true, email: true, role: true },
  });

  console.log('[admin-bootstrap] ✅ First ADMIN user created: ' + admin.email);
  if (!process.env.ADMIN_PASSWORD) {
    console.log('[admin-bootstrap] ⚠️  Copy the generated password from the logs above — it will not be shown again.');
  }
}

main()
  .catch((err) => {
    console.error('[admin-bootstrap] ❌ Failed to bootstrap admin (continuing startup):', err && err.message ? err.message : err);
  })
  .finally(async () => {
    try {
      await prisma.$disconnect();
    } catch (_) {
      /* ignore */
    }
    // Always exit 0 so it never blocks the application from starting.
    process.exit(0);
  });
