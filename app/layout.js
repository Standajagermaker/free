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

export default function RootLayout({children}){
  const p = usePathname() || "/";

  const active = (path) => p.startsWith(path);

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
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 20px",
    background: "rgba(245,245,240,0.94)",
    backdropFilter: "blur(8px)",
    borderBottom: "1px solid #ddd",
    fontFamily: "Arial"
  }}
>

  <div style={{ fontSize: 18, fontWeight: 700 }}>
    feel free to ...
  </div>

  <div style={{ display: "flex", gap: 8 }}>
    <a href="/" style={{...navLink, ...(active("/") && {border:"2px solid #111"})}}>Ads</a>
    <a href="/ideas" style={{...navLink, ...(active("/ideas") && {border:"2px solid #111"})}}>Events</a>
    <a href="/trips" style={{...navLink, ...(active("/trips") && {border:"2px solid #111"})}}>Trips</a>
    <a href="/scams" style={{...navLink, ...(active("/scams") && {border:"2px solid #111"})}}>Scams</a>
    <a href="/statistics" style={{...navLink, ...(active("/statistics") && {border:"2px solid #111"})}}>Stats</a>
  </div>

</nav>

        {children}
      </body>
    </html>
  )
}
