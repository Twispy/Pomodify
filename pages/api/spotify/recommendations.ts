import { NextApiRequest, NextApiResponse } from 'next';
import { getToken } from 'next-auth/jwt';

const secret = process.env.NEXTAUTH_SECRET;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const token = await getToken({ req, secret });
    if (!token || !token.accessToken) {
      return res.status(401).json({ message: "Token d'accès manquant" });
    }

    const { trackUri } = req.query;
    if (!trackUri || typeof trackUri !== 'string') {
      return res.status(400).json({ message: 'Paramètre trackUri manquant' });
    }
    const trackId = trackUri.replace('spotify:track:', '');

    // Appel à l'API Spotify Recommendations
    const params = new URLSearchParams({
      seed_tracks: trackId,
      limit: '30',
    });
    const response = await fetch(`https://api.spotify.com/v1/recommendations?${params.toString()}`, {
      headers: {
        'Authorization': `Bearer ${token.accessToken}`,
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return res.status(response.status).json({ message: 'Erreur Spotify', error });
    }
    const data = await response.json();
    const uris = (data.tracks || []).map((t: any) => t.uri);
    return res.status(200).json({ uris });
  } catch (error) {
    return res.status(500).json({ message: 'Erreur serveur', error: error instanceof Error ? error.message : 'Erreur inconnue' });
  }
} 