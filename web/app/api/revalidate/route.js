import { NextResponse } from 'next/server';
import { invalidateWorkspaceCache } from '../../../lib/workspace-cache';

export async function POST() {
  invalidateWorkspaceCache();
  return NextResponse.json({ ok: true });
}
