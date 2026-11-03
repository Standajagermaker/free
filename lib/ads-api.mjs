// Server module: never import into a client component.
export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export function reply(data, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store, private', 'X-Content-Type-Options': 'nosniff' } });
}
export async function body(request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) throw new ApiError(403, 'Invalid origin.');
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new ApiError(415, 'JSON required.');
  // Bound actual streamed bytes, including requests without Content-Length.
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, 'JSON required.');
  let size = 0; const chunks = [];
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    size += value.byteLength;
    if (size > 32768) { await reader.cancel(); throw new ApiError(413, 'Request too large.'); }
    chunks.push(value);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new ApiError(400, 'Invalid JSON.'); }
}
export function text(value, max, required = false) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw new ApiError(400, 'Invalid input.');
  return value;
}
export function adId(value) { return text(value, 100, true); }
export async function rpc(name, args = {}) {
  const base = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw new ApiError(503, 'Ads service is not configured.');
  const result = await fetch(`${base}/rest/v1/rpc/${name}`, {
    method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(15000),
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args)
  });
  if (!result.ok) throw new ApiError(503, 'Ads service temporarily unavailable.');
  return result.json();
}
export async function handle(action) {
  try { return reply(await action()); }
  catch (error) { return reply({ error: error instanceof ApiError ? error.message : 'Ads service temporarily unavailable.' }, error instanceof ApiError ? error.status : 503); }
}
export function validateAd(input) {
  if (!input || !['secret', 'public'].includes(input.response_mode)) throw new ApiError(400, 'Choose a response mode.');
  const out = {};
  for (const [key, max, required] of [['title',200,true],['description',10000,true],['city',200,true],['event_date',100],['event_time',100],['public_contact',1000],['image_url',2048]]) {
    out[key] = text(input[key] ?? '', max, required);
  }
  for (const [key, max] of [['lat',90],['lng',180]]) {
    const value = input[key];
    if (value != null && (!Number.isFinite(value) || Math.abs(value) > max)) throw new ApiError(400, 'Invalid coordinates.');
    out[key] = value ?? null;
  }
  out.response_mode = input.response_mode;
  if (input.response_mode === 'secret') {
    out.password = text(input.password, 72, true);
    if (out.password.length < 12 || Buffer.byteLength(out.password, 'utf8') > 72) throw new ApiError(400, 'Use a password of at least 12 characters and at most 72 UTF-8 bytes.');
    out.public_contact = '';
  } else {
    if (!out.public_contact.trim()) throw new ApiError(400, 'Public contact is required.');
    out.password = '';
  }
  return out;
}
export async function readReplies(id, input) {
  const password = text(input?.password ?? '', 256);
  if (Buffer.byteLength(password, 'utf8') > 72) throw new ApiError(400, 'Password is too long.');
  const result = await rpc('ff_read_replies', { p_ad_id: adId(id), p_password: password });
  if (result.error) throw new ApiError(result.status || 403, result.error);
  return result;
}
