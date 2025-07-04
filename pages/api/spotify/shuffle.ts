import { NextApiRequest, NextApiResponse } from 'next';
import { getToken } from 'next-auth/jwt';

const secret = process.env.NEXTAUTH_SECRET;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const token = await getToken({ req, secret });
    if (!token || !token.accessToken) {
      return res.status(401).json({ message: "Token d'accès manquant" });
    }

    const { state, deviceId } = req.query;
    if (typeof state !== 'string') {
      return res.status(400).json({ message: 'Paramètre state manquant' });
    }

    let url = `https://api.spotify.com/v1/me/player/shuffle?state=${state}`;
    if (deviceId && typeof deviceId === 'string') {
      url += `&device_id=${deviceId}`;
    }

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token.accessToken}`,
        'Content-Type': 'application/json',
      },
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