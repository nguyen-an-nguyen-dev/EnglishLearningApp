import { createContext, useContext, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';

type BuddyVideoPage = { focus: string; detail?: string };
const VideoPage = createContext<BuddyVideoPage | null>(null);
const SetVideoPage = createContext<Dispatch<SetStateAction<BuddyVideoPage | null>>>(() => undefined);

export function BuddyVideoProvider({ children }: { children: ReactNode }) {
  const [page, setPage] = useState<BuddyVideoPage | null>(null);
  return (
    <SetVideoPage.Provider value={setPage}>
      <VideoPage.Provider value={page}>{children}</VideoPage.Provider>
    </SetVideoPage.Provider>
  );
}

export const useBuddyVideoPage = () => useContext(VideoPage);
export const useSetBuddyVideoPage = () => useContext(SetVideoPage);
