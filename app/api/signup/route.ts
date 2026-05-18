import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { name, email, password } = data;

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 },
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: {
        email: email,
      },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "User already exists with this email" },
        { status: 409 },
      );
    }

    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(password, salt);

    const newUser = await prisma.user.create({
      data: {
        name: name,
        email: email,
        password: hashedPassword,
      },
    });
    // if (!process.env.JWT_SECRET) {
    //     throw new Error("JWT_SECRET is not defined.");
    // }
    // const token = jwt.sign(
    //     { id: newUser.id, email: newUser.email },
    //     process.env.JWT_SECRET,
    //     { expiresIn: '24h' }
    // );

    return NextResponse.json(
      {
        message: "User created successfully",
        user: newUser,
        // token: token
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Registration error:", error);
    const errorMessage = "User registration failed due to an unexpected error.";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
