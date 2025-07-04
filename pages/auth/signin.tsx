import { signIn, useSession } from "next-auth/react";
import { useEffect } from "react";
import { useRouter } from "next/router";

export default function SignIn() {
  const { data: session } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session) {
      router.push("/dashboard");
    }
  }, [session]);

  return (
    <div style={{ textAlign: "center", marginTop: "100px" }}>
      <h1>Se connecter avec Spotify</h1>
      <button
        onClick={() => signIn("spotify", { callbackUrl: "/dashboard" })}
        style={{ padding: "10px 20px", fontSize: "16px", cursor: "pointer" }}
      >
        Se connecter avec Spotify
      </button>
    </div>
  );
}
