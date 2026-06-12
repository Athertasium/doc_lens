import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.email || !body?.password) {
    return NextResponse.json({ success: false, error: "Email and password required" }, { status: 400 });
  }

  const email = (body.email as string).toLowerCase().trim();
  const { password, name } = body as { password: string; name?: string };

  if (password.length < 8) {
    return NextResponse.json({ success: false, error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const exists = await db.user.findUnique({ where: { email } });
  if (exists) {
    return NextResponse.json({ success: false, error: "Email already registered" }, { status: 409 });
  }

  const hash = await bcrypt.hash(password, 12);
  const user = await db.user.create({
    data: { email, password: hash, name: name?.trim() || null },
  });

  return NextResponse.json({ success: true, data: { id: user.id, email: user.email } });
}
