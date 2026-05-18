import { create } from "zustand";

interface Client {
  id: string;
  name: string;
  email?: string;
}

interface ClientStore {
  client: Client | null;
  saveClient: (client: Client) => void;
  getClient: () => Client | null;
  removeClient: () => void;
}

export const useClientStore = create<ClientStore>((set, get) => ({
  client: null,

  saveClient: (client) => set({ client }),

  getClient: () => get().client,

  removeClient: () => set({ client: null }),
}));
