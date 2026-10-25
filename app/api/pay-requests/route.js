const categories=new Set(["Essentials","Housing","Education","Health","Other"]);
const reply=(body,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"no-store"}});
export async function POST(request){
 if(Number(request.headers.get("content-length")||0)>4000000)return reply({error:"Request too large."},413);
 let b;try{b=await request.json()}catch{return reply({error:"Invalid request."},400)}
 const title=String(b?.title||"").trim(),story=String(b?.story||"").trim(),category=String(b?.category||"");
 const amount=Number(b?.amount),nominee=String(b?.nominee||"").trim(),hashtag=String(b?.hashtag||"").trim();
 if(title.length<3||title.length>90||story.length<15||story.length>700||!categories.has(category)||!Number.isFinite(amount)||amount<1||amount>100000||nominee.length>80||hashtag.length>60||b?.consent!==true)return reply({error:"Please check the required fields."},400);
 const base=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if(!base||!key)return reply({error:"Submission is not configured yet."},503);
 const headers={apikey:key,Authorization:"Bearer "+key};
 let imagePath=null;
 const imageData=b?.imageData;
 if(imageData){
  if(typeof imageData!=="string"||imageData.length>2900000)return reply({error:"Image too large."},413);
  const match=/^data:(image\/png|image\/jpeg|image\/webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(imageData);
  if(!match)return reply({error:"Only JPG, PNG or WebP images are supported."},400);
  const bytes=Buffer.from(match[2],"base64");
  if(bytes.length>2*1024*1024)return reply({error:"Image must be under 2 MB."},413);
  const mime=match[1];
  const valid=mime==="image/png"?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):mime==="image/jpeg"?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:bytes.subarray(0,4).toString()==="RIFF"&&bytes.subarray(8,12).toString()==="WEBP";
  if(!valid)return reply({error:"Invalid image file."},400);
  imagePath=crypto.randomUUID()+"."+(mime==="image/png"?"png":mime==="image/jpeg"?"jpg":"webp");
  try{
   const upload=await fetch(base+"/storage/v1/object/pay-images/"+imagePath,{method:"POST",headers:{...headers,"Content-Type":mime,"x-upsert":"false"},body:bytes,cache:"no-store"});
   if(!upload.ok){console.error("private image upload",upload.status);return reply({error:"Image storage is not ready. Please try again later."},503)}
  }catch{return reply({error:"Image storage is temporarily unavailable."},503)}
 }
 try{
  const row={title,story,category,amount,nominee,hashtag};
  if(imagePath)row.image_url=imagePath;
  const res=await fetch(base+"/rest/v1/pay_requests",{method:"POST",cache:"no-store",headers:{...headers,"Content-Type":"application/json",Prefer:"return=minimal"},body:JSON.stringify(row)});
  if(!res.ok){console.error("pay_requests insert",res.status);return reply({error:"Could not save your request."},503)}
  return reply({ok:true,message:"Your project has been submitted and is now visible in the community ranking."},201);
 }catch{return reply({error:"Service temporarily unavailable."},503)}
}
