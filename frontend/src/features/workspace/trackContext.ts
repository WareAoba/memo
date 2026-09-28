import { createContext, useContext } from 'react';
import type { Track, Tracks } from '../../api/tracks';

export type TrackControls = {
  track: Track;
  tracks: Tracks;
  select: (id: string, href?: string) => Promise<boolean>;
  updated: (track: Track) => void;
};
export const TrackContext = createContext<TrackControls | null>(null);
export function useTracks() {
  const value = useContext(TrackContext);
  if (!value) throw new Error('TrackBoundary is required');
  return value;
}
