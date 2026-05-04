"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const Map = dynamic(() => import("../Map"), { ssr: false });

const inputStyle = { width: "100%", padding: 10, border: "1px solid #ddd", borderRadius: 10 };
const buttonStyle = { padding: "9px 12px", border: 0, borderRadius: 9, background: "#111", color: "white" };
const smallButton = { padding: "6px 9px", borderRadius: 8, border: "1px solid #ccc", background: "white", fontSize: 13 };
const primaryButton = { ...smallButton, background: "#111", color: "white" };

function inviteUrl(t){
  return `/?title=${encodeURIComponent(`Anyone for ${t.title}?`)}&city=${encodeURIComponent(t.city||"")}`;
}

export default function TripsPage(){
  const [tips,setTips]=useState([]);
  const [query,setQuery]=useState("");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  async function load(){
    const r=await fetch(`${supabaseUrl}/rest/v1/trip_tips?select=*`,{
      headers:{apikey:anonKey,Authorization:`Bearer ${anonKey}`}
    });
    const d=await r.json();
    setTips(Array.isArray(d)?d:[]);
  }

  useEffect(()=>{load();},[]);

  async function create(e){
    e.preventDefault();
    const f=new FormData(e.target);

    await fetch(`${supabaseUrl}/rest/v1/trip_tips`,{
      method:"POST",
      headers:{
        apikey:anonKey,
        Authorization:`Bearer ${anonKey}`,
        "Content-Type":"application/json"
      },
      body:JSON.stringify({
        title:f.get("title"),
        description:f.get("description"),
        city:f.get("city"),
        street:f.get("street"),
        url:f.get("url")
      })
    });

    e.target.reset();
    load();
  }

  const filtered=tips.filter(t =>
    `${t.title} ${t.description} ${t.city}`.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <main style={{padding:20,fontFamily:"Arial"}}>

      <p style={{color:"#555"}}>Places worth going. No schedule. Just go.</p>

      <div style={{display:"grid",gridTemplateColumns:"300px 1fr",gap:16}}>

        {/* LEFT */}
        <div>
          <Map ads={filtered}/>

          {/* FORM JE ZPĚT */}
          <form onSubmit={create} style={{display:"grid",gap:8,background:"white",padding:12,borderRadius:12}}>
            <input name="title" placeholder="Place" required style={inputStyle}/>
            <textarea name="description" placeholder="Description" required style={inputStyle}/>
            <input name="city" placeholder="City" required style={inputStyle}/>
            <input name="street" placeholder="Street" style={inputStyle}/>
            <input name="url" placeholder="Link" style={inputStyle}/>
            <button style={buttonStyle}>Add</button>
          </form>
        </div>

        {/* RIGHT */}
        <div>
          <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search"
                 style={{width:"100%",padding:8,marginBottom:10}}/>

          {filtered.map(t=>(
            <div key={t.id} style={{background:"white",padding:10,marginBottom:8,borderRadius:10}}>

              <div style={{display:"flex",justifyContent:"space-between"}}>
                <b>{t.title}</b>
                <span>{t.city}</span>
              </div>

              <div style={{color:"#555"}}>{t.description}</div>

              {/* TADY JE TEN FIX */}
              <div style={{
                display:"flex",
                justifyContent:"space-between",
                alignItems:"center",
                marginTop:6
              }}>

                {/* LEFT INFO */}
                <span style={{fontSize:12,color:"#777"}}>
                  {t.street || ""}
                  {t.lat && t.lng ? ` · ${t.lat.toFixed(4)}, ${t.lng.toFixed(4)}` : ""}
                </span>

                {/* RIGHT BUTTONS */}
                <div style={{display:"flex",gap:6}}>
                  <a href={inviteUrl(t)} style={primaryButton}>Invite</a>
                  {t.url && <a href={t.url} target="_blank" style={smallButton}>Open</a>}
                </div>

              </div>

            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
