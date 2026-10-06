/* M0 foundation only: proves the admin app builds and boots. No CMS,
   auth, API calls or navigation yet — those arrive in later milestones. */
export default function App() {
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "3rem", maxWidth: "40rem" }}>
      <h1 style={{ margin: 0 }}>RBB Admin</h1>
      <p style={{ color: "#555" }}>Internal development screen. Nothing is connected yet.</p>
    </main>
  );
}
