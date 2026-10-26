import { createRouter, createWebHistory, type RouteLocationNormalized } from 'vue-router';

import RoomListView from '@/views/RoomListView.vue';

import { useAuthStore } from '@/stores/auth';
import type { LocationState } from '@/api/types';
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
  }
}

const roomSlug = (route: RouteLocationNormalized): string => String(route.params['slug'] ?? '');

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'rooms', component: RoomListView },
    {
      path: '/rooms/new',
      name: 'room-create',
      component: () => import('@/views/RoomCreateView.vue'),
      meta: { requiresLogin: true },
    },
    {
      path: '/room/:slug',
      component: () => import('@/views/RoomView.vue'),
      beforeEnter: async (to) => {
        await useCurrentRoomStore().open(roomSlug(to));
      },
      children: [
        { path: '', name: 'roster', component: () => import('@/views/RosterView.vue') },
        { path: 'players', name: 'players', component: () => import('@/views/PlayerSummaryView.vue') },
        { path: 'statistics', name: 'statistics', component: () => import('@/views/StatisticsView.vue') },
        { path: 'unlock-tree', name: 'unlock-tree', component: () => import('@/views/UnlockTreeView.vue') },
        {
          path: 'spheres',
          name: 'spheres',
          component: () => import('@/views/SphereOverviewView.vue'),
          meta: { requiresLocations: true },
        },
        ...(['open', 'found', 'filler'] as LocationState[]).map((state) => ({
          path: `locations/${state}`,
          name: `locations-${state}`,
          component: () => import('@/views/LocationsView.vue'),
          meta: { locationState: state, requiresLocations: true },
        })),
        {
          path: 'my-slots',
          name: 'my-slots',
          component: () => import('@/views/MySlotsView.vue'),
          meta: { requiresRole: 'player' },
        },
        {
          path: 'control',
          component: () => import('@/views/ControlView.vue'),
          meta: { requiresRole: 'helper' },
          children: [
            { path: '', name: 'control', component: () => import('@/views/ControlMessagesView.vue') },
            {
              path: 'spheres',
              name: 'control-spheres',
              component: () => import('@/views/ControlSpheresView.vue'),
              meta: { requiresLocations: true, sphereLocations: true },
            },
            ...(['open', 'found', 'filler'] as LocationState[]).map((state) => ({
              path: `locations/${state}`,
              name: `control-locations-${state}`,
              component: () => import('@/views/LocationsView.vue'),
              meta: { locationState: state, locationView: 'admin' as const, requiresLocations: true },
            })),
            {
              path: 'messages',
              name: 'control-messages',
              component: () => import('@/views/ControlMessagesView.vue'),
            },
            {
              path: 'warnings',
              name: 'control-warnings',
              component: () => import('@/components/admin/WarningsPanel.vue'),
              meta: { requiresRole: 'admin' },
            },
            {
              path: 'server',
              name: 'control-server',
              component: () => import('@/views/ControlServerView.vue'),
              meta: { requiresRole: 'admin', requiresLocations: true },
            },
          ],
        },
        {
          path: 'admin/:tab?',
          name: 'admin',
          component: () => import('@/views/AdminView.vue'),
          meta: { requiresRole: 'helper' },
        },
      ],
    },
    {
      path: '/invite/:token',
      name: 'invitation',
      component: () => import('@/views/InvitationView.vue'),
      meta: { requiresLogin: true },
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
