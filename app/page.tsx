const projects = [
  { name: "Untitled Project", scenes: 0, status: "Ready" },
  { name: "Product Launch", scenes: 8, status: "In progress" },
  { name: "Brand Story", scenes: 5, status: "Ready" },
];

export default function Home() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", gridTemplateColumns: "240px 1fr" }}>
      <aside style={{ borderRight: "1px solid #242428", padding: 24 }}>
        <div style={{ fontWeight: 800, letterSpacing: "-.03em", fontSize: 20 }}>AI VIDEO STUDIO</div>
        <div style={{ color: "#71717a", fontSize: 12, marginTop: 6 }}>Production workspace</div>
        <nav style={{ marginTop: 42, display: "grid", gap: 8 }}>
          {['Studio', 'Projects', 'Storyboard', 'Assets', 'Characters', 'Locations', 'Styles'].map((item, i) => (
            <div key={item} style={{ padding: "11px 12px", borderRadius: 10, background: i === 0 ? "#18181b" : "transparent", color: i === 0 ? "#fff" : "#a1a1aa" }}>{item}</div>
          ))}
        </nav>
        <div style={{ marginTop: 48, borderTop: "1px solid #242428", paddingTop: 20, color: "#71717a", fontSize: 12 }}>SYSTEM</div>
        <nav style={{ marginTop: 8, display: "grid", gap: 8 }}>
          {['Generations', 'Queue', 'Accounts', 'Usage', 'Settings'].map(item => <div key={item} style={{ padding: "9px 12px", color: "#a1a1aa" }}>{item}</div>)}
        </nav>
      </aside>

      <section style={{ padding: "48px 56px", maxWidth: 1500, width: "100%" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ color: "#71717a", fontSize: 13, marginBottom: 10 }}>STUDIO</div>
            <h1 style={{ fontSize: 42, lineHeight: 1.05, letterSpacing: "-.045em", margin: 0 }}>Create something cinematic.</h1>
            <p style={{ color: "#a1a1aa", marginTop: 14, maxWidth: 650 }}>Turn an idea, reference, or storyboard into production-ready AI video. Your creative system stays separate from the generation provider.</p>
          </div>
          <button style={{ background: "#f4f4f5", color: "#09090b", border: 0, borderRadius: 10, padding: "12px 18px", fontWeight: 700 }}>+ New project</button>
        </header>

        <div style={{ marginTop: 42, display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 18 }}>
          <article style={{ border: "1px solid #27272a", borderRadius: 16, padding: 24, background: "linear-gradient(145deg,#151518,#0e0e10)" }}>
            <div style={{ color: "#a1a1aa", fontSize: 12 }}>QUICK CREATE</div>
            <h2 style={{ margin: "10px 0 8px", fontSize: 24 }}>Start from an idea</h2>
            <p style={{ color: "#71717a", lineHeight: 1.6 }}>Describe the scene in plain language. The Creative Engine will structure subject, action, camera, lighting, style and audio before generation.</p>
            <div style={{ marginTop: 22, display: "flex", gap: 10 }}>
              <button style={{ background: "#f4f4f5", color: "#09090b", border: 0, borderRadius: 9, padding: "10px 14px", fontWeight: 700 }}>Create video</button>
              <button style={{ background: "#18181b", color: "#d4d4d8", border: "1px solid #27272a", borderRadius: 9, padding: "10px 14px" }}>Open Pro Mode</button>
            </div>
          </article>
          <article style={{ border: "1px solid #27272a", borderRadius: 16, padding: 24 }}>
            <div style={{ color: "#a1a1aa", fontSize: 12 }}>GENERATION SYSTEM</div>
            <div style={{ marginTop: 18, display: "grid", gap: 12 }}>
              {['Creative Engine', 'Google Veo provider', 'Account & quota manager', 'Job queue'].map((x, i) => <div key={x} style={{ display: "flex", justifyContent: "space-between", paddingBottom: 12, borderBottom: i < 3 ? "1px solid #202023" : 0 }}><span>{x}</span><span style={{ color: "#71717a" }}>{i === 1 ? 'Not connected' : 'Ready'}</span></div>)}
            </div>
          </article>
        </div>

        <section style={{ marginTop: 44 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><h2 style={{ fontSize: 20, margin: 0 }}>Recent projects</h2><span style={{ color: "#71717a", fontSize: 13 }}>View all</span></div>
          <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
            {projects.map(project => <div key={project.name} style={{ border: "1px solid #27272a", borderRadius: 14, padding: 18 }}><div style={{ height: 120, borderRadius: 10, background: "#141416", marginBottom: 16 }} /><div style={{ fontWeight: 700 }}>{project.name}</div><div style={{ color: "#71717a", fontSize: 13, marginTop: 7 }}>{project.scenes} scenes · {project.status}</div></div>)}
          </div>
        </section>
      </section>
    </main>
  );
}
