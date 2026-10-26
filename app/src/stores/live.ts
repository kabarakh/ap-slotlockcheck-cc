import { ref } from 'vue';
import { defineStore } from 'pinia';
import { createLiveSocket, LIVE_MESSAGES, type LiveSocket } from '@/api/socket';
import { useCurrentRoomStore } from './current-room';

export const useLiveStore = defineStore('live', () => {
  const isConnected = ref(false);
  const joinedSlug = ref<string | null>(null);
  let socket: LiveSocket | null = null;

  const join = () => {
    if (socket && joinedSlug.value) {
      socket.emit(LIVE_MESSAGES.roomJoin, joinedSlug.value, () => undefined);
    }
  };

  const connect = () => {
    if (socket) {
      return;
    }
    socket = createLiveSocket();
    socket.on('connect', () => {
      isConnected.value = true;
      join();
    });
    socket.on('disconnect', () => {
      isConnected.value = false;
    });
    socket.on(LIVE_MESSAGES.roomSynced, (payload) => useCurrentRoomStore().applySynced(payload));
    socket.on(LIVE_MESSAGES.roomSyncFailed, (payload) => useCurrentRoomStore().applySyncFailed(payload));
    socket.on(LIVE_MESSAGES.roomUpdated, (payload) => useCurrentRoomStore().applyUpdated(payload));
    socket.on(LIVE_MESSAGES.locationsChanged, (payload) => void useCurrentRoomStore().applyLocationsChanged(payload));
    socket.connect();
  };

  const joinRoom = (slug: string) => {
    joinedSlug.value = slug;
    connect();
    join();
  };

  const leaveRoom = () => {
    if (socket && joinedSlug.value) {
      socket.emit(LIVE_MESSAGES.roomLeave, joinedSlug.value);
    }
    joinedSlug.value = null;
  };

  return { isConnected, joinedSlug, connect, joinRoom, leaveRoom };
});
