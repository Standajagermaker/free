const out=(data,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"no-store"}});
const config=()=>({base:process.env.NEXT_PUBLIC_SUPABASE_URL,key:process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY});
export async function GET(){
 const {base,key}=config();if(!base||!key)return out({error:"Voting is not configured."},503);
 try{const r=await fetch(base+"/rest/v1/rpc/pay_leaderboard",{method:"POST",headers:{apikey:key,Authorization:"Bearer "+key,"Content-Type":"application/json"},body:"{}",cache:"no-store"});if(!r.ok)return out({error:"Leaderboard unavailable."},503);return out({projects:await r.json()})}catch{return out({error:"Leaderboard unavailable."},503)}
}
export async function POST(request){
 const {base,key}=config();if(!base||!key)return out({error:"Voting is not configured."},503);
 const token=(request.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
 if(!token)return out({error:"Verify your email to vote."},401);
 let data;try{data=await request.json()}catch{return out({error:"Invalid request."},400)}
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data?.project_id||""))return out({error:"Invalid project."},400);
 try{
  const userRes=await fetch(base+"/auth/v1/user",{headers:{apikey:key,Authorization:"Bearer "+token},cache:"no-store"});
  if(!userRes.ok)return out({error:"Please sign in again."},401);
  const user=await userRes.json();
  if(!user?.id||!user?.email_confirmed_at)return out({error:"Verified email required."},403);
  const res=await fetch(base+"/rest/v1/pay_votes",{method:"POST",headers:{apikey:key,Authorization:"Bearer "+token,"Content-Type":"application/json",Prefer:"return=minimal"},body:JSON.stringify({user_id:user.id,project_id:data.project_id}),cache:"no-store"});
  if(res.status===409)return out({error:"You have already voted. Only one vote per account is allowed."},409);
  if(!res.ok)return out({error:"Could not vote. Please select an approved project."},400);
  return out({ok:true},201);
 }catch{return out({error:"Voting unavailable."},503)}
}
