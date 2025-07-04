import { NextApiRequest, NextApiResponse } from 'next';
import { getToken } from 'next-auth/jwt';

const secret = process.env.NEXTAUTH_SECRET;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const token = await getToken({ req, secret });
    if (!token || !token.accessToken) {
      return res.status(401).json({ message: "Token d'accès manquant" });
    }

    // Récupérer l'URI personnalisée et le deviceId envoyés par le client
    const { uri, deviceId } = req.body;
    let body: any = {};
    if (uri) {
      if (uri.startsWith('spotify:track:')) {
        body.uris = [uri];
      } else {
        body.context_uri = uri;
        body.offset = { position: 0 };
        body.position_ms = 0;
      }
    } else {
      body.context_uri = 'spotify:playlist:37i9dQZF1DX3PFzdbtx1Us';
      body.offset = { position: 0 };
      body.position_ms = 0;
    }

    // Si deviceId fourni, transférer la lecture sur ce device
    let url = 'https://api.spotify.com/v1/me/player/play';
    if (deviceId) {
      url += `?device_id=${deviceId}`;
    }

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return res.status(response.status).json({ message: 'Erreur Spotify', error });
    }

    return res.status(204).end();
  } catch (error) {
    return res.status(500).json({ message: 'Erreur serveur', error: error instanceof Error ? error.message : 'Erreur inconnue' });
  }
} 