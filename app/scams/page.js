export default function ScamsPage(){
  return (
    <main style={{padding:20,fontFamily:"Arial",background:"#f5f5f0",minHeight:"100vh"}}>
      <h1 style={{marginTop:0}}>Unmask scammers</h1>
      <p style={{color:"#555"}}>Scammer Safari inside feel free 2.</p>

      <div style={{background:"white",border:"1px solid #ddd",borderRadius:14,overflow:"hidden",height:"calc(100vh - 150px)",minHeight:600}}>
        <iframe
          src="https://scammer-safari.vercel.app/"
          title="Scammer Safari"
          style={{width:"100%",height:"100%",border:0}}
          loading="lazy"
        />
      </div>
    </main>
  );
}
