"use client";

import { usePathname } from "next/navigation";

const navLink = {
  color: "#111",
  textDecoration: "none",
  fontWeight: "bold",
  padding: "8px 10px",
  border: "1px solid #ddd",
  borderRadius: 10,
  background: "white"
};

function SubHeader(){
  const p = usePathname() || "/";
  let text = "Free anonymous ads";
  if(p.startsWith("/ideas")) text = "Events";
  if(p.startsWith("/trips")) text = "Trip tips";
  return (
    <div style={{padding:"10px 20px",borderBottom:"1px solid #eee",fontFamily:"Arial"}}>
      <div style={{fontSize:28,fontWeight:700}}>{text}</div>
    </div>
  );
}

export default function RootLayout({children}){
  return (
    <html>
      <head>
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      </head>
      <body style={{ margin: 0, background: "#f5f5f0" }}>
        <nav style={{ position:"sticky", top:0, zIndex:1000, display:"flex", justifyContent:"space-between", alignItems:"center", gap:12, padding:"10px 20px", background:"rgba(245,245,240,0.94)", backdropFilter:"blur(8px)", borderBottom:"1px solid #ddd", fontFamily:"Arial" }}>
          <a href="/" style={{ color: "#111", textDecoration: "none", fontWeight: "900", fontSize: 20 }}>feel free 2</a>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <a href="/" style={navLink}>Ads</a>
            <a href="/ideas" style={navLink}>Events</a>
            <a href="/trips" style={navLink}>Trips</a>
            <a href="/statistics" style={navLink}>Stats</a>
          </div>
        </nav>
        <SubHeader />
        {children}
      </body>
    </html>
  )
}
