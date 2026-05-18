import { PrismaClient } from '@prisma/client';
import { NextResponse } from 'next/server';

const prisma = new PrismaClient();

export async function POST(request: Request) {
    try {
        const data = await request.json();
        const { email, code } = data;

        if (!email || !code) {
            return NextResponse.json({ error: 'Email and code are required' }, { status: 400 });
        }

        const user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const currentTime = new Date(); 
        const isCodeValid = user.resetCode === code && user.resetCodeExpiry !== null && user.resetCodeExpiry > currentTime;

        if (!isCodeValid) {
            return NextResponse.json({ error: 'Invalid or expired verification code' }, { status: 401 });
        }

        await prisma.user.update({
            where: { email },
            data: { resetCode: null, resetCodeExpiry: null }
        });

        return NextResponse.json({ message: "Verification successful" }, { status: 200 });

    } catch (error) {
        console.error('Verification Error:', error);
        return NextResponse.json({ error: 'Failed to verify due to an unexpected error' }, { status: 500 });
    }
}
