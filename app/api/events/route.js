// Feel Free 2: verified event catalogue. No invented dates or placeholder events.
const VERIFIED = [
  {id:"de-pubquiz-20261113",title:"7. PubQuiz der KjG Deggendorf",city:"Deggendorf",category:"meetup",event_date:"2026-11-13",event_time:"20:00",source:"Stadt Deggendorf",url:"https://www.deggendorf.de/veranstaltungen/event/pubquiz-november-2026"},
  {id:"de-windlicht-20261115",title:"Lichterfarbenschimmer – gefilztes Windlicht",city:"Deggendorf",category:"workshop",event_date:"2026-11-15",event_time:"10:00",source:"Stadt Deggendorf",url:"https://www.deggendorf.de/veranstaltungen/event/lichterfarbenschimmer-gefilztes-windlicht-november-2026"},
  {id:"de-walk-20261115",title:"Deggendorfer Sonntagsspaziergang",city:"Deggendorf",category:"outdoor",event_date:"2026-11-15",event_time:"14:00",source:"Stadt Deggendorf",url:"https://www.deggendorf.de/veranstaltungen/event/deggendorfer-sonntagsspaziergang-november-2026"},
  {id:"de-tower-20261128",title:"Rathausturmführung im Advent",city:"Deggendorf",category:"culture",event_date:"2026-11-28",event_time:"17:00",source:"Stadt Deggendorf",url:"https://www.deggendorf.de/veranstaltungen/event/rathausturmfuehrung-im-advent"},
  {id:"de-quantum-20261102",title:"Quantum Academy Herbstschule (2.–4.11.)",city:"Deggendorf",category:"workshop",event_date:"2026-11-02",event_time:"08:00",source:"Stadt Deggendorf",url:"https://www.deggendorf.de/veranstaltungen/event/zocken-erlaubt-lernen-garantiert-quantum-academy-herbstschule-november-2026-thd-quantum-academy"},
  {id:"mun-joe-20261101",title:"Joe Jackson & Band – Circus Krone",city:"Munich",category:"concert",event_date:"2026-11-01",event_time:"19:30",source:"muenchen.de",url:"https://www.muenchen.de/veranstaltungen/november"},
  {id:"mun-lang-20261101",title:"Lang Lang – Isarphilharmonie",city:"Munich",category:"concert",event_date:"2026-11-01",event_time:"20:00",source:"muenchen.de",url:"https://www.muenchen.de/veranstaltungen/november"},
  {id:"mun-slam-20261102",title:"113. Schwabinger Poetry Slam",city:"Munich",category:"culture",event_date:"2026-11-02",event_time:"20:00",source:"muenchen.de",url:"https://www.muenchen.de/veranstaltungen/november"},
  {id:"mun-nfl-20261115",title:"NFL Munich Game: Patriots vs. Lions",city:"Munich",category:"sport",event_date:"2026-11-15",event_time:"",source:"muenchen.de",url:"https://www.muenchen.de/veranstaltungen/november"},
  {id:"mun-tokio-20261116",title:"Tokio Hotel – Olympiahalle",city:"Munich",category:"concert",event_date:"2026-11-16",event_time:"",source:"muenchen.de",url:"https://www.muenchen.de/veranstaltungen/november"},
  {id:"mun-xmas-20261120",title:"Münchner Christkindlmarkt – Eröffnung",city:"Munich",category:"festival",event_date:"2026-11-20",event_time:"",source:"muenchen.de",url:"https://www.muenchen.de/veranstaltungen/top-events-2026-muenchen"},
  {id:"mun-tollwood-20261124",title:"Winter-Tollwood – Festivalstart",city:"Munich",category:"festival",event_date:"2026-11-24",event_time:"",source:"muenchen.de",url:"https://www.muenchen.de/veranstaltungen/november"}
];
const isoDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s || "");
async function supabaseEvents() {
  const base=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(!base||!key)return [];
  const res=await fetch(base+"/rest/v1/events?select=*&order=event_date.asc&limit=500",{headers:{apikey:key,Authorization:"Bearer "+key},cache:"no-store"});
  if(!res.ok)return [];
  const data=await res.json();
  return Array.isArray(data)?data:[];
}
export async function GET(request) {
  const today=new Date().toISOString().slice(0,10);
  let stored=[];
  try { stored=await supabaseEvents(); } catch {}
  // Only externally sourced, date-valid records; exclude historical seed and synthetic import sources.
  const realStored=stored.filter(e=>isoDate(e.event_date)&&e.event_date>=today&&e.url&&e.source&&!/seed|search|import|style|curated|supabase/i.test(e.source));
  const byKey=new Map();
  for(const e of [...VERIFIED,...realStored]){
    if(!isoDate(e.event_date)||e.event_date<today)continue;
    const key=[e.title,e.city,e.event_date].map(x=>String(x||"").trim().toLowerCase()).join("|");
    if(!byKey.has(key))byKey.set(key,e);
  }
  const events=[...byKey.values()].sort((a,b)=>(a.event_date+" "+(a.event_time||"")).localeCompare(b.event_date+" "+(b.event_time||"")));
  if(new URL(request.url).searchParams.get("debug")==="1")return Response.json({source_used:"verified+filtered-supabase",verified_count:VERIFIED.length,stored_eligible:realStored.length,final_count:events.length,sample:events[0]||null});
  return Response.json(events);
}
