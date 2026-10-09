/**
 * Database Seed Example
 * 
 * To run this seed script in your local environment:
 * 1. Copy this file to `seed.ts` in the same directory:
 *    cp services/api/prisma/seed.example.ts services/api/prisma/seed.ts
 * 2. Customize the seeding logic or default credentials in your local `seed.ts` if needed.
 * 3. `seed.ts` is ignored in Git to prevent checking in sensitive credentials.
 * 4. Run the seed command:
 *    pnpm --filter @rent-stay/api prisma:seed
 */

import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()
const SALT_ROUNDS = 12


async function main() {
  console.log('🌱 Seeding database...')

  // ─── Platform Config ───────────────────────────────────────────────────────
  await prisma.platformConfig.upsert({
    where:  { id: 'singleton' },
    update: {},
    create: { id: 'singleton', platformFeePercent: 2.0, maxPhotosPerListing: 10, otpExpirySeconds: 300, rentDueDayOfMonth: 1 },
  })
  console.log('✅ Platform config seeded')

  // ─── Amenities ─────────────────────────────────────────────────────────────
  const amenities = [
    { name: 'WiFi',            icon: 'wifi',            sortOrder: 1  },
    { name: 'AC',              icon: 'air-conditioner', sortOrder: 2  },
    { name: 'Geyser',          icon: 'geyser',          sortOrder: 3  },
    { name: 'Parking',         icon: 'parking',         sortOrder: 4  },
    { name: 'Lift',            icon: 'lift',            sortOrder: 5  },
    { name: 'Power Backup',    icon: 'power-backup',    sortOrder: 6  },
    { name: 'Security',        icon: 'security',        sortOrder: 7  },
    { name: 'CCTV',            icon: 'cctv',            sortOrder: 8  },
    { name: 'Gym',             icon: 'gym',             sortOrder: 9  },
    { name: 'Laundry',         icon: 'laundry',         sortOrder: 10 },
    { name: 'Kitchen',         icon: 'kitchen',         sortOrder: 11 },
    { name: 'Fridge',          icon: 'fridge',          sortOrder: 12 },
    { name: 'Washing Machine', icon: 'washing-machine', sortOrder: 13 },
    { name: 'TV',              icon: 'tv',              sortOrder: 14 },
    { name: 'Balcony',         icon: 'balcony',         sortOrder: 15 },
    { name: 'Swimming Pool',   icon: 'pool',            sortOrder: 16 },
    { name: 'Meals Included',  icon: 'meals',           sortOrder: 17 },
    { name: 'Water Purifier',  icon: 'water-purifier',  sortOrder: 18 },
  ]
  for (const a of amenities) {
    await prisma.amenity.upsert({ where: { name: a.name }, update: {}, create: a })
  }
  console.log('✅ 18 amenities seeded')

  // ─── Admin user (email + password only — no self-registration) ─────────────
  const adminPassword = process.env.ADMIN_SEED_PASSWORD ?? 'Admin@12345'
  const adminHash     = await bcrypt.hash(adminPassword, SALT_ROUNDS)
  await prisma.user.upsert({
    where:  { phone: 'ADMIN_SEED' },
    update: { passwordHash: adminHash },
    create: {
      phone:        'ADMIN_SEED',
      email:        process.env.ADMIN_SEED_EMAIL ?? 'admin@rentandstay.in',
      name:         'Admin',
      role:         'admin',
      kycStatus:    'verified',
      isActive:     true,
      passwordHash: adminHash,
    },
  })
  console.log(`✅ Admin seeded`)
  console.log(`   email:    ${process.env.ADMIN_SEED_EMAIL ?? 'admin@rentandstay.in'}`)
  console.log(`   password: ${adminPassword}`)
  console.log(`   login:    Email + Password only (port 3003)`)

  // ─── Sample owner — phone OTP + email + Google all supported ───────────────
  //     Existing user: can log in via Phone OTP, Email+Password, or Google
  const ownerPassword = 'Owner@12345'
  const ownerHash     = await bcrypt.hash(ownerPassword, SALT_ROUNDS)
  await prisma.user.upsert({
    where:  { phone: '9876543210' },
    update: { passwordHash: ownerHash },
    create: {
      phone:            '9876543210',
      email:            'owner@rentandstay.in',
      name:             'Ramesh Sharma',
      role:             'owner',
      kycStatus:        'verified',
      isActive:         true,
      passwordHash:     ownerHash,   // enables Email+Password login
      panNumber:        'ABCDE1234F',
      aadhaarVerified:  true,
      panVerified:      true,
      bankVerified:     true,
      bankAccountNumber:'1234567890',
      bankIfsc:         'SBIN0001234',
      bankAccountName:  'Ramesh Sharma',
    },
  })
  console.log(`✅ Owner seeded`)
  console.log(`   phone:    9876543210  (OTP login — port 3002)`)
  console.log(`   email:    owner@rentandstay.in`)
  console.log(`   password: ${ownerPassword}  (Email login — port 3002)`)

  // ─── Sample tenant — phone OTP + email + Google all supported ─────────────
  //     Existing user: can log in via Phone OTP, Email+Password, or Google
  const tenantPassword = 'Tenant@12345'
  const tenantHash     = await bcrypt.hash(tenantPassword, SALT_ROUNDS)
  await prisma.user.upsert({
    where:  { phone: '9123456780' },
    update: { passwordHash: tenantHash },
    create: {
      phone:            '9123456780',
      email:            'tenant@rentandstay.in',
      name:             'Priya Patel',
      role:             'tenant',
      kycStatus:        'verified',
      isActive:         true,
      passwordHash:     tenantHash,  // enables Email+Password login
      permanentAddress: '42, MG Road, Bangalore',
      city:             'Bangalore',
    },
  })
  console.log(`✅ Tenant seeded`)
  console.log(`   phone:    9123456780  (OTP login — port 3001)`)
  console.log(`   email:    tenant@rentandstay.in`)
  console.log(`   password: ${tenantPassword}  (Email login — port 3001)`)

  console.log('')
  console.log('─────────────────────────────────────────────────────')
  console.log('Login Flow Summary')
  console.log('─────────────────────────────────────────────────────')
  console.log('Tenant / Owner (existing users):')
  console.log('  • Phone → OTP → Login')
  console.log('  • Email + Password → Login')
  console.log('  • Google → Login')
  console.log('Tenant / Owner (new users via OTP first):')
  console.log('  • Phone → OTP → Set Password → Account created')
  console.log('Tenant / Owner (new users via Google first):')
  console.log('  • Google → Phone → OTP → Set Password → Account created')
  console.log('Admin:')
  console.log('  • Email + Password → Login  (no self-registration)')
  console.log('─────────────────────────────────────────────────────')
  console.log('')
  console.log('🎉 Seeding complete!')
}

main()
  .catch((e) => { console.error('❌ Seed failed:', e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
