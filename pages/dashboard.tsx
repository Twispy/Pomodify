import { useSession } from "next-auth/react";
import PomodoroTimer from "../components/PomodoroTimer";

export default function Dashboard() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <p>Chargement...</p>;
  }

  if (!session) {
    return <p>Accès refusé. Veuillez vous connecter.</p>;
  }

  return (
    <div style={{ textAlign: "center", marginTop: "100px" }}>
      <h1>Bienvenue {session.user?.name} 🎧</h1>
      <p>Connexion à Spotify réussie.</p>
      <PomodoroTimer /> {/* ⏱️ Timer intégré ici */}
    </div>
  );
}
