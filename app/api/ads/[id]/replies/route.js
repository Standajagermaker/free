import { adId, body, handle, rpc, text } from '../../../../../lib/ads-api.mjs';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request, { params }) {
  return handle(async () => {
    const input = await body(request);
    await rpc('ff_send_reply', { p_ad_id: adId((await params).id), p_message: text(input.message, 10000, true), p_contact: text(input.contact, 1000, true) });
    return { ok: true };
  });
}
