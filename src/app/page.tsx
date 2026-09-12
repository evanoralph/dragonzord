import ScrollVideo from "@/components/ScrollVideo";

export default function HomePage() {
  console.log("[page] HomePage render — dragon zord first (no intro scrub section)");

  return (
    <main>
      <ScrollVideo />

      <section
        style={{
          minHeight: "60vh",
          display: "grid",
          placeItems: "center",
          padding: "2rem",
          textAlign: "center",
        }}
      >
        <p style={{ opacity: 0.65 }}>End of demo.</p>
      </section>
    </main>
  );
}
