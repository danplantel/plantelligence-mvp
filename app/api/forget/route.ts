import { PrismaClient } from '@prisma/client';
import { NextResponse } from 'next/server';
import sendResetEmail from '@/lib/sendResetEmail';

const prisma = new PrismaClient();

export async function POST(request: Request) {
    try {
        const data = await request.json();
        const { email } = data;

        if (!email) {
            return NextResponse.json({ error: 'Email field is required' }, { status: 400 });
        }

        const user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

        const expiryDate = new Date();
        expiryDate.setHours(expiryDate.getHours() + 24);

        const baseUrl = "http://localhost:3001";

        const emailResult = await sendResetEmail(email, verificationCode, baseUrl);
        if (!emailResult) {
            throw new Error('Failed to send reset email');
        }

        await prisma.user.update({
            where: { email },
            data: { resetCode: verificationCode, resetCodeExpiry: expiryDate }
        });

        return NextResponse.json({ message: "Reset email sent successfully" }, { status: 200 });

    } catch (error) {
        console.error('Reset Password Error:', error);
        const errorMessage = 'Failed to process reset password request due to an unexpected error.';
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
