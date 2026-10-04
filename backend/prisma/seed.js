require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const day = 24 * 60 * 60 * 1000;
const at = (days, hour) => {
  const d = new Date(Date.now() + days * day);
  d.setHours(hour, 0, 0, 0);
  return d;
};

const events = [
  { title: 'Summer Rock Festival', venue: 'Riverside Arena, Austin', days: 14, hour: 18, price: 79.0, seats: 200 },
  { title: 'Jazz Under the Stars', venue: 'Central Park Amphitheatre, New York', days: 21, hour: 20, price: 45.5, seats: 120 },
  { title: 'Tech Innovators Summit', venue: 'Convention Center, San Francisco', days: 30, hour: 9, price: 199.0, seats: 500 },
  { title: 'Stand-Up Comedy Night', venue: 'The Laugh Factory, Chicago', days: 7, hour: 21, price: 25.0, seats: 60 },
  { title: 'Classical Symphony Evening', venue: 'Royal Concert Hall, Boston', days: 45, hour: 19, price: 95.0, seats: 300 },
];

async function main() {
  if ((await prisma.event.count()) > 0) {
    console.log('Events already exist, skipping seed.');
    return;
  }
  for (const e of events) {
    await prisma.event.create({
      data: {
        title: e.title,
        venue: e.venue,
        event_date: at(e.days, e.hour),
        price: e.price,
        total_seats: e.seats,
        available_seats: e.seats,
      },
    });
  }
  console.log(`Seeded ${events.length} events.`);
}

main().finally(() => prisma.$disconnect());
