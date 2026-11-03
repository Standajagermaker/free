import { body, handle, rpc, validateAd } from '../../../lib/ads-api.mjs';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() { return handle(() => rpc('ff_list_ads')); }
export async function POST(request) {
  return handle(async () => { await rpc('ff_create_ad', { p_ad: validateAd(await body(request)) }); return { ok: true }; });
}
