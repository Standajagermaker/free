const categories=new Set(["Essentials","Housing","Education","Health","Other"]);
const reply=(data,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"no-store"}});
export async function POST(request){
 if(Number(request.headers.get("content-length")||0)>12000)return reply({error:"Request too large."},413);
 let b;try{b=await request.json()}catch{return reply({error:"Invalid JSON."},400)}
 const title=String(b?.title||"").trim(),story=String(b?.story||"").trim(),category=String(b?.category||"");
 const amount=Number(b?.amount),nominee=String(b?.nominee||"").trim(),hashtag=String(b?.hashtag||"").trim();
 if(b?.website)return reply({ok:true},201);
 if(title.length<3||title.length>90||story.length<15||story.length>700||!categories.has(category)||!Number.isFinite(amount)||amount<1||amount>100000||nominee.length>80||hashtag.length>60||b?.consent!==true)return reply({error:"Please check the required fields."},400);
 const imageData=String(b?.imageData||"");
 if(imageData.length>2000000)return reply({error:"Image too large. Choose a smaller image."},413);
 const base=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if(!base||!key)return reply({error:"Submission is not configured yet."},503);
 try{const res=await fetch(base+"/rest/v1/pay_requests",{method:"POST",cache:"no-store",headers:{apikey:key,Authorization:"Bearer "+key,"Content-Type":"application/json",Prefer:"return=minimal"},body:JSON.stringify({title,story,category,amount,nominee,hashtag})});if(!res.ok){console.error("pay_requests insert status",res.status);return reply({error:"Unable to save. Please try again later."},503)}return reply({ok:true,message:"Your request has been saved for review. Nothing has been published."},201)}catch{return reply({error:"Service temporarily unavailable."},503)}
}
