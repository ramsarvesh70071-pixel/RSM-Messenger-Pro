import { create } from 'zustand';
import { IStatusFeedGroup, IStatus } from '../types';
import { api } from '../services/api';
import { socketService } from '../services/socket.service';

interface StatusState {
  feed: IStatusFeedGroup[];
  myStatuses: IStatus[];
  activeViewerGroup: IStatusFeedGroup | null;
  activeViewerIndex: number;
  isLoading: boolean;

  fetchFeed: () => Promise<void>;
  fetchMyStatuses: () => Promise<void>;
  createStatus: (payload: { type: string; content: string; caption?: string; backgroundColor?: string }) => Promise<void>;
  viewStatus: (statusId: string) => Promise<void>;
  deleteStatus: (statusId: string) => Promise<void>;
  openViewer: (group: IStatusFeedGroup, index?: number) => void;
  closeViewer: () => void;
  nextStatus: () => void;
  prevStatus: () => void;
  setupSocketListeners: () => void;
}

export const useStatusStore = create<StatusState>((set, get) => ({
  feed: [],
  myStatuses: [],
  activeViewerGroup: null,
  activeViewerIndex: 0,
  isLoading: false,

  fetchFeed: async () => {
    try {
      const res = await api.get('/status/feed');
      set({ feed: res.data.data });
    } catch {}
  },

  fetchMyStatuses: async () => {
    try {
      const res = await api.get('/status/my');
      set({ myStatuses: res.data.data });
    } catch {}
  },

  createStatus: async (payload) => {
    try {
      await api.post('/status', payload);
      await get().fetchMyStatuses();
      get().fetchFeed();
    } catch (err) {
      console.error('Failed to post status:', err);
    }
  },

  viewStatus: async (statusId: string) => {
    try {
      await api.post(`/status/${statusId}/view`);
    } catch {}
  },

  deleteStatus: async (statusId: string) => {
    try {
      await api.delete(`/status/${statusId}`);
      set((state) => ({ myStatuses: state.myStatuses.filter((x) => x._id !== statusId) }));
      get().fetchFeed();
    } catch {}
  },

  openViewer: (group, index = 0) => {
    set({ activeViewerGroup: group, activeViewerIndex: index });
    const currentStatus = group.statuses[index];
    if (currentStatus) {
      get().viewStatus(currentStatus._id);
    }
  },

  closeViewer: () => {
    set({ activeViewerGroup: null, activeViewerIndex: 0 });
    get().fetchFeed();
  },

  nextStatus: () => {
    const { activeViewerGroup, activeViewerIndex } = get();
    if (!activeViewerGroup) return;

    if (activeViewerIndex < activeViewerGroup.statuses.length - 1) {
      const nextIdx = activeViewerIndex + 1;
      set({ activeViewerIndex: nextIdx });
      get().viewStatus(activeViewerGroup.statuses[nextIdx]._id);
    } else {
      get().closeViewer();
    }
  },

  prevStatus: () => {
    const { activeViewerIndex } = get();
    if (activeViewerIndex > 0) {
      set({ activeViewerIndex: activeViewerIndex - 1 });
    }
  }
,

  setupSocketListeners: () => {
    const socket = socketService.getSocket();
    if (!socket) return;
    socket.off('status:new');
    socket.on('status:new', () => {
      get().fetchFeed();
      get().fetchMyStatuses();
    });
    socket.off('status:view');
    socket.on('status:view', () => get().fetchMyStatuses());
  }
}));
