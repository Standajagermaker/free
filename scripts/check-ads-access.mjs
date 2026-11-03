// Read-only verification. Never prints values, response bodies or credentials.
const base=process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if(!base || !key) throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.');
const paths=['ads?select=password&limit=1','ads?select=password_hash&limit=1','responses?select=id&limit=1'];
if(process.env.PRIVATE_AD_ID) paths.push(`responses?select=id&ad_id=eq.${encodeURIComponent(process.env.PRIVATE_AD_ID)}&limit=1`);
for(const path of paths) {
 const res=await fetch(`${base}/rest/v1/${path}`,{headers:{apikey:key,Authorization:`Bearer ${key}`},cache:'no-store'});
 const data=await res.json();
 const rows=Array.isArray(data)?data:[];
 console.log(JSON.stringify({probe:path.split('?')[0],column:new URLSearchParams(path.split('?')[1]).get('select'),status:res.status,returnedRows:rows.length,containsNonemptyPassword:rows.some(r=>typeof r.password==='string'&&r.password.length>0)}));
 if(res.ok) { console.error('FAIL: direct client table access must be denied after migration.'); process.exitCode=1; }
 else if(![400,401,403].includes(res.status)) { console.error('INCONCLUSIVE: unexpected error; do not treat this as proof of protection.'); process.exitCode=1; }
}
