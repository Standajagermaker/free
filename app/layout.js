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
  let text = "Create anonymous ads";
  if(p.startsWith("/ideas")) text = "Events";
  if(p.startsWith("/trips")) text = "Trip tips";
  return (
    <div style={{padding:"12px 20px",borderBottom:"1px solid #eee",fontFamily:"Arial",fontSize:26,fontWeight:700}}>
      {text}
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
<nav
  style={{
    position: "sticky",
    top: 0,
    zIndex: 1000,
    display: "flex",
    justifyContent: "space-between", // 👈 důležité
    alignItems: "center",
    padding: "10px 20px",
    background: "rgba(245,245,240,0.94)",
    backdropFilter: "blur(8px)",
    borderBottom: "1px solid #ddd",
    fontFamily: "Arial"
  }}
>

  {/* 👈 LEVÁ STRANA = HEADLINE */}
  <div style={{ fontSize: 18, fontWeight: 700 }}>
    feel free 2 ...
  </div>

  {/* 👉 PRAVÁ STRANA = NAV */}
  <div style={{ display: "flex", gap: 8 }}>
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
