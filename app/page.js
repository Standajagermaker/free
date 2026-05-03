"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";

const Map = dynamic(() => import("./Map"), { ssr: false });

export default function Page() {
  const [ads, setAds] = useState([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  async function loadAds() {
    const res = await fetch(`${supabaseUrl}/rest/v1/ads?select=*&order=created_at.desc` ,{
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`
      }
    });
    const data = await res.json();
    setAds(data);
  }

  useEffect(()=>{loadAds()},[]);

  const filtered = ads.filter(a =>
    (a.title||"").toLowerCase().includes(query.toLowerCase())
  );

  return (
    <main style={{padding:20,fontFamily:"Arial"}}>

      <h1>feelfree</h1>

      <div style={{display:"grid",gridTemplateColumns:"1fr 2fr",gap:16}}>

        <div>
          <Map ads={ads} />
        </div>

        <div>
          <input
            placeholder="search..."
            value={query}
            onChange={e=>setQuery(e.target.value)}
            style={{width:"100%",padding:10,marginBottom:10}}
          />

          <div style={{display:"grid",gap:8}}>
            {filtered.map(ad=> (
              <div key={ad.id} style={{border:"1px solid #ddd",padding:10,borderRadius:10,fontSize:14}}>

                <div style={{display:"flex",justifyContent:"space-between"}}>
                  <b>{ad.title}</b>
                  <span>{ad.city}</span>
                </div>

                <div style={{color:"#555",margin:"6px 0"}}>{ad.description}</div>

                {ad.image_url && (
                  <img src={ad.image_url} style={{width:120,borderRadius:8}} />
                )}

                <div style={{display:"flex",gap:10,marginTop:6}}>
                  <button>Reply</button>
                  <button>Read</button>
                </div>

              </div>
            ))}
          </div>

        </div>

      </div>

    </main>
  );
}
