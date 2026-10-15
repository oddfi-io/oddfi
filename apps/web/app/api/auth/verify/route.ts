import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const { code } = await request.json();
  const INVITE_CODE = process.env.INVITE_CODE;

  if (!INVITE_CODE || code !== INVITE_CODE) {
    return NextResponse.json({ error: '邀请码无效' }, { status: 401 });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set('access-token', INVITE_CODE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30天
  });
  return response;
}
