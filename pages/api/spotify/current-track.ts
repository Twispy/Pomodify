import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Récupérer la session côté serveur
    const session = await getServerSession(req, res, authOptions);
    
    console.log('Session récupérée:', session ? 'Oui' : 'Non');
    
    if (!session) {
      return res.status(401).json({ message: 'Non autorisé' });
    }

    // Récupérer le token d'accès depuis la session
    const accessToken = (session as any).accessToken;
    
    console.log('Token d\'accès:', accessToken ? 'Présent' : 'Manquant');
    
    if (!accessToken) {
      return res.status(401).json({ message: 'Token d\'accès manquant' });
    }

    // Appeler l'API Spotify pour récupérer la piste actuelle
    const response = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('Réponse Spotify:', response.status);

    if (response.status === 204) {
      // Aucune piste en cours de lecture
      console.log('Aucune piste en cours de lecture');
      return res.json({ track: null });
    }

    if (!response.ok) {
      console.error('Erreur Spotify:', response.status, response.statusText);
      throw new Error(`Erreur Spotify: ${response.status}`);
    }

    const data = await response.json();
    console.log('Données Spotify reçues:', data ? 'Oui' : 'Non');
    
    if (!data.item) {
      console.log('Aucun item dans la réponse');
      return res.json({ track: null });
    }

    console.log('Piste trouvée:', data.item.name);

    // Retourner les informations de la piste
    return res.json({
      track: {
        name: data.item.name,
        artists: data.item.artists,
        album: data.item.album,
        duration: data.item.duration_ms,
        progress: data.progress_ms,
        isPlaying: data.is_playing
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération de la piste:', error);
    return res.status(500).json({ message: 'Erreur serveur', error: error instanceof Error ? error.message : 'Erreur inconnue' });
  }
} 