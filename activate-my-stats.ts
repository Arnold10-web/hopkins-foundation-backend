/**
 * Quick script to activate your zeros row
 * Run: npx tsx activate-my-stats.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

async function activateStats() {
  console.log('\n🔍 Checking organization_stats...\n');

  try {
    // Show all rows
    const allStats = await prisma.organizationStats.findMany({
      orderBy: { createdAt: 'desc' }
    });

    console.log(`Found ${allStats.length} row(s):\n`);
    allStats.forEach((stat, index) => {
      console.log(`${index + 1}. ${stat.label}`);
      console.log(`   Lives: ${stat.livesTransformed} | Programs: ${stat.programsActive} | Countries: ${stat.countriesServed}`);
      console.log(`   Active: ${stat.isActive} | Display Order: ${stat.displayOrder}`);
      console.log(`   ID: ${stat.id}\n`);
    });

    // Find your zeros row
    const zerosRow = allStats.find(s => 
      s.livesTransformed === 0 && 
      s.programsActive === 0 && 
      s.countriesServed === 0
    );

    if (zerosRow) {
      console.log('✅ Found your zeros row!');
      
      if (zerosRow.isActive) {
        console.log('✅ It is already active!');
        console.log('\nThe API will return this row.');
        console.log('If homepage still shows 25,000+, you need to upload the NEW dist/ folder.\n');
      } else {
        console.log('⚠️  It is NOT active. Activating it now...\n');
        
        // Deactivate all others first
        await prisma.organizationStats.updateMany({
          data: { isActive: false }
        });
        
        // Activate yours
        await prisma.organizationStats.update({
          where: { id: zerosRow.id },
          data: { 
            isActive: true,
            displayOrder: 100
          }
        });
        
        console.log('✅ Your zeros row is now active!');
        console.log('✅ Backend will now return your zeros.');
        console.log('🔄 Upload the NEW dist/ folder to see it on homepage.\n');
      }
    } else {
      console.log('❌ No zeros row found!');
      console.log('\nOptions:');
      console.log('1. Create one in admin panel');
      console.log('2. Or update an existing row above to your desired values\n');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

activateStats();
