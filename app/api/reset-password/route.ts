import { PrismaClient } from '@prisma/client';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { verifyResetToken } from '@/lib/reset-token.server';

const prisma = new PrismaClient();

export async function POST(request: Request) {
    try {
        const data = await request.json();
        const { email, newPassword, resetToken } = data;

        if (!email || !newPassword) {
            return NextResponse.json({ error: 'Email and new password are required' }, { status: 400 });
        }

        // Proof that the verification-code step was completed for THIS email.
        const verifiedEmail = verifyResetToken(resetToken);
        if (!verifiedEmail || verifiedEmail !== email.trim().toLowerCase()) {
            return NextResponse.json({ error: 'Invalid or expired reset token' }, { status: 401 });
        }

        const user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Optionally check for any policy regarding password (length, complexity etc.)
        if (newPassword.length < 8) {
            return NextResponse.json({ error: 'Password must be at least 8 characters long' }, { status: 400 });
        }

        const salt = bcrypt.genSaltSync(10);
        const hashedPassword = bcrypt.hashSync(newPassword, salt);

        await prisma.user.update({
            where: { email },
            data: { password: hashedPassword }
        });

        return NextResponse.json({ message: "Password reset successful" }, { status: 200 });

    } catch (error) {
        console.error('Password Reset Error:', error);
        return NextResponse.json({ error: 'Failed to reset password due to an unexpected error' }, { status: 500 });
    }
}
