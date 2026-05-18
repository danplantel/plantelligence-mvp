import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Latest NewClientKeyContacts Records ---');
    const keyContactsRecords = await prisma.newClientKeyContacts.findMany({
        orderBy: { updatedAt: 'desc' },
        take: 3,
    });

    for (const record of keyContactsRecords) {
        console.log(`\nSession ID: ${record.sessionId}`);
        console.log('Contacts JSON:', JSON.stringify(record.contacts, null, 2));
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
