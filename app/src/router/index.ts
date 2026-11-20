import { createRouter, createWebHistory, type RouteLocationNormalized } from 'vue-router';

import RoomListView from '@/views/RoomListView.vue';

import type { LocationState } from '@/api/types';
import { useAuthStore } from '@/stores/auth';
import { useCurrentRoomStore } from '@/stores/current-room';
import { useLocationsStore, type LocationView } from '@/stores/locations';

declare module 'vue-router' {
  interface RouteMeta {
    requiresLogin?: boolean;
    requiresRole?: 'player' | 'helper' | 'admin';
    locationState?: LocationState;
    locationView?: LocationView;
    sphereLocations?: boolean;
    requiresLocations?: boolean;
    requiresSlotLock?: boolean;
    title?: string[];
  }
}

const roomSlug = (route: RouteLocationNormalized): string => String(route.params['slug'] ?? '');

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'rooms', component: RoomListView, meta: { title: ['app.rooms'] } },
    {
      path: '/rooms/new',
      name: 'room-create',
      component: () => import('@/views/RoomCreateView.vue'),
      meta: { requiresLogin: true, title: ['app.newRoom'] },
    },
    {
      path: '/room/:slug',
      component: () => import('@/views/RoomView.vue'),
      beforeEnter: async (to) => {
        await useCurrentRoomStore().open(roomSlug(to));
      },
      children: [
        {
          path: '',
          name: 'roster',
          component: () => import('@/views/RosterView.vue'),
          meta: { title: ['room.tabs.roster'] },
        },
        {
          path: 'players',
          name: 'players',
          component: () => import('@/views/PlayerSummaryView.vue'),
          meta: { title: ['room.tabs.players'] },
        },
        {
          path: 'statistics',
          component: () => import('@/views/StatisticsView.vue'),
          children: [
            {
              path: '',
              name: 'statistics',
              component: () => import('@/components/room/StatisticsPanel.vue'),
              meta: { title: ['statistics.tabs.overview', 'room.tabs.statistics'] },
            },
            {
              path: 'unlock-times',
              name: 'statistics-unlock-times',
              component: () => import('@/components/statistics/UnlockTimesPanel.vue'),
              meta: { requiresSlotLock: true, title: ['statistics.tabs.unlockTimes', 'room.tabs.statistics'] },
            },
            {
              path: 'unlock-senders',
              name: 'statistics-unlock-senders',
              component: () => import('@/components/statistics/UnlockSendersPanel.vue'),
              meta: { requiresSlotLock: true, title: ['statistics.tabs.unlockSenders', 'room.tabs.statistics'] },
            },
            {
              path: 'progress',
              name: 'statistics-progress',
              component: () => import('@/components/statistics/ProgressPanel.vue'),
              meta: { title: ['statistics.tabs.progress', 'room.tabs.statistics'] },
            },
          ],
        },
        {
          path: 'unlock-tree',
          name: 'unlock-tree',
          component: () => import('@/views/UnlockTreeView.vue'),
          meta: { requiresSlotLock: true, title: ['room.tabs.unlockTree'] },
        },
        {
          path: 'spheres',
          name: 'spheres',
          component: () => import('@/views/SphereOverviewView.vue'),
          meta: { requiresLocations: true, title: ['room.tabs.spheres'] },
        },
        ...(['open', 'found', 'filler'] as LocationState[]).map((state) => ({
          path: `locations/${state}`,
          name: `locations-${state}`,
          component: () => import('@/views/LocationsView.vue'),
          meta: { locationState: state, requiresLocations: true, title: [`locations.states.${state}`] },
        })),
        {
          path: 'my-slots',
          name: 'my-slots',
          component: () => import('@/views/MySlotsView.vue'),
          meta: { requiresRole: 'player', title: ['room.tabs.mySlots'] },
        },
        {
          path: 'control',
          component: () => import('@/views/ControlView.vue'),
          meta: { requiresRole: 'helper', title: ['room.tabs.control'] },
          children: [
            { path: '', name: 'control', component: () => import('@/views/ControlMessagesView.vue') },
            {
              path: 'spheres',
              name: 'control-spheres',
              component: () => import('@/views/ControlSpheresView.vue'),
              meta: {
                requiresLocations: true,
                sphereLocations: true,
                title: ['control.tabs.spheres', 'room.tabs.control'],
              },
            },
            ...(['open', 'found', 'filler'] as LocationState[]).map((state) => ({
              path: `locations/${state}`,
              name: `control-locations-${state}`,
              component: () => import('@/views/LocationsView.vue'),
              meta: {
                locationState: state,
                locationView: 'admin' as const,
                requiresLocations: true,
                title: [`locations.states.${state}`, 'room.tabs.control'],
              },
            })),
            {
              path: 'messages',
              name: 'control-messages',
              component: () => import('@/views/ControlMessagesView.vue'),
              meta: { title: ['control.tabs.messages', 'room.tabs.control'] },
            },
            {
              path: 'pace',
              name: 'control-pace',
              component: () => import('@/views/ControlPaceView.vue'),
              meta: { requiresRole: 'helper', title: ['control.tabs.pace', 'room.tabs.control'] },
            },
            {
              path: 'dependencies',
              name: 'control-dependencies',
              component: () => import('@/components/control/DependenciesPanel.vue'),
              meta: { requiresLocations: true, title: ['control.tabs.dependencies', 'room.tabs.control'] },
            },
            {
              path: 'notes',
              name: 'control-notes',
              component: () => import('@/components/control/NotesPanel.vue'),
              meta: { title: ['control.tabs.notes', 'room.tabs.control'] },
            },
            {
              path: 'warnings',
              name: 'control-warnings',
              component: () => import('@/components/admin/WarningsPanel.vue'),
              meta: { requiresRole: 'admin', title: ['control.tabs.warnings', 'room.tabs.control'] },
            },
            {
              path: 'server',
              name: 'control-server',
              component: () => import('@/views/ControlServerView.vue'),
              meta: {
                requiresRole: 'admin',
                requiresLocations: true,
                title: ['control.tabs.server', 'room.tabs.control'],
              },
            },
          ],
        },
        {
          path: 'admin/:tab?',
          name: 'admin',
          component: () => import('@/views/AdminView.vue'),
          meta: { requiresRole: 'helper', title: ['room.tabs.admin'] },
        },
      ],
    },
    {
      path: '/invite/:token',
      name: 'invitation',
      component: () => import('@/views/InvitationView.vue'),
      meta: { requiresLogin: true, title: ['invitations.title'] },
    },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('@/views/NotFoundView.vue') },
  ],
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  await auth.ensureLoaded();
  if (to.meta.requiresLogin && !auth.isLoggedIn) {
    auth.login(to.fullPath);
    return false;
  }
  if (!to.path.startsWith('/room/')) {
    useCurrentRoomStore().close();
  }
  if (!to.meta.locationState) {
    useLocationsStore().leave();
  }
  return true;
});

const hasRole = (required: 'player' | 'helper' | 'admin'): boolean => {
  const room = useCurrentRoomStore();
  return { player: room.isPlayer, helper: room.isHelper, admin: room.isAdmin }[required];
};

router.beforeResolve(async (to) => {
  const required = to.meta.requiresRole;
  if (required && !hasRole(required)) {
    return { name: 'roster', params: { slug: roomSlug(to) } };
  }
  if (to.meta.requiresLocations && !useCurrentRoomStore().canSeeLocations) {
    return { name: 'roster', params: { slug: roomSlug(to) } };
  }
  if (to.meta.requiresSlotLock && !useCurrentRoomStore().hasSlotLock) {
    return { name: 'roster', params: { slug: roomSlug(to) } };
  }
  if (to.name === 'control') {
    const target = useCurrentRoomStore().canSeeLocations ? 'control-spheres' : 'control-messages';
    return { name: target, params: { slug: roomSlug(to) } };
  }
  const state = to.meta.locationState;
  if (state && to.query['view'] === 'admin' && hasRole('helper')) {
    return { name: `control-locations-${state}`, params: { slug: roomSlug(to) } };
  }
  if (state) {
    await useLocationsStore().enter(state, to.meta.locationView ?? 'user');
  }
  return true;
});

export default router;
