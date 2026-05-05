"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";

const Map = dynamic(() => import("./Map"), { ssr: false });

// ... (rest unchanged)

export default function Page() {
  // (existing logic unchanged)

  return (
    <main style={{ padding: 20, fontFamily: "Arial", background: "#f5f5f0", minHeight: "100vh", overflowX: "hidden" }}>

      <h1 style={{ marginBottom: 12 }}>Create anonymous ads</h1>

      {/* removed feel free 2 header */}

      {/* rest of component unchanged */}

    </main>
  );
}
