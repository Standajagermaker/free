import { body, handle, readReplies } from '../../../../../../lib/ads-api.mjs';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request, { params }) {
  return handle(async () => readReplies((await params).id, await body(request)));
}
