// pages/api/auth/[...nextauth].ts
import NextAuth, { NextAuthOptions } from "next-auth";
import SpotifyProvider from "next-auth/providers/spotify";

// Étendre les types pour inclure le token d'accès
declare module "next-auth" {
  interface Session {
    accessToken?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    SpotifyProvider({
      clientId: process.env.SPOTIFY_CLIENT_ID!,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET!,
      authorization:
        "https://accounts.spotify.com/authorize?scope=user-read-email,user-read-private,streaming,user-read-playback-state,user-modify-playback-state,user-read-currently-playing",
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/auth/signin",
    newUser: "/dashboard",
  },
  callbacks: {
    async jwt({ token, account }) {
      // Rafraîchissement automatique du token Spotify
      const now = Math.floor(Date.now() / 1000);
      // Si on vient de se connecter, stocker les infos du compte
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at;
        return token;
      }
      // Si le token est encore valide, le retourner
      if (token.expiresAt && now < token.expiresAt) {
        return token;
      }
      // Sinon, rafraîchir le token
      if (token.refreshToken) {
        try {
          const basic = Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64');
          const response = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${basic}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              grant_type: 'refresh_token',
              refresh_token: token.refreshToken,
            }),
          });
          const refreshed = await response.json();
          if (!response.ok) throw refreshed;
          token.accessToken = refreshed.access_token;
          // Certains refresh ne renvoient pas de nouveau refresh_token
          if (refreshed.refresh_token) {
            token.refreshToken = refreshed.refresh_token;
          }
          // expires_in est en secondes
          token.expiresAt = now + (refreshed.expires_in || 3600);
          return token;
        } catch (e) {
          console.error('Erreur lors du rafraîchissement du token Spotify', e);
          // Si le refresh échoue, forcer la reconnexion
          return { ...token, error: 'RefreshAccessTokenError' };
        }
      }
      // Si pas de refresh token, forcer la reconnexion
      return { ...token, error: 'NoRefreshToken' };
    },
    async session({ session, token }) {
      // Passer le token d'accès à la session
      session.accessToken = token.accessToken;
      return session;
    },
    async redirect({ url, baseUrl }) {
      return url.startsWith(baseUrl) ? url : baseUrl;
    },
  },
};

export default NextAuth(authOptions);
