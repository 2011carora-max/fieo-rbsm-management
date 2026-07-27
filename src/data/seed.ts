import type { Activity, User } from '@/types';

// V1 ships empty — no seed activities. Only the demo login accounts are seeded
// so the app is usable immediately. Real data is created by users.

const ISO = (d: Date) => d.toISOString();

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return ISO(d);
}

const offices = ['Delhi', 'Mumbai', 'Chennai', 'Kolkata', 'Bengaluru', 'Ahmedabad', 'Hyderabad', 'Lucknow', 'Jaipur'];

export function seedActivities(): Activity[] {
  return [];
}

export function seedUsers(): User[] {
  return [
    {
      id: 'usr-admin',
      name: 'HO Administrator',
      email: 'admin@fieo.org',
      password: 'admin123',
      role: 'admin',
      active: true,
      createdAt: daysAgo(120),
    },
    ...offices.slice(0, 6).map((office, i) => ({
      id: `usr-${office.toLowerCase().slice(0, 3)}`,
      name: `${office} Regional User`,
      email: `${office.toLowerCase()}@fieo.org`,
      password: 'region123',
      role: 'regional' as const,
      regionalOffice: office,
      active: true,
      createdAt: daysAgo(100 - i * 5),
    })),
  ];
}
