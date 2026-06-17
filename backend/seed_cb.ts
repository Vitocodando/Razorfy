import { prisma } from './src/prisma';
(async () => {
  const a = await prisma.appointment.create({ data: {
    clientId: '0a5dcc89-dc0e-4d39-bb76-60559779b425', barberId: '22222222-2222-2222-2222-222222222222',
    startTimestamp: new Date('2026-06-14T18:00:00Z'), endTimestamp: new Date('2026-06-14T18:30:00Z'),
    totalPrice: '35', cashbackUsed: '10', amountPaid: '25', paymentMethod: 'PRESENTIAL', status: 'CONFIRMED',
  }});
  console.log('APPTID=' + a.id); await prisma.$disconnect();
})();
