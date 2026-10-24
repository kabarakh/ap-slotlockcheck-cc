import { createRouter, createWebHistory, type RouteLocationNormalized } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useCurrentRoomStore } from '@/stores/current-room';
import RoomListView from '@/views/RoomListView.vue';

declare module 'vue-router' {
  interface RouteMeta {
    requiresLogin?: boolean;
    requiresRole?: 'player' | 'admin';
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
        {
          path: 'my-slots',
          name: 'my-slots',
          component: () => import('@/views/MySlotsView.vue'),
          meta: { requiresRole: 'player' },
        },
        {
          path: 'admin',
          name: 'admin',
          component: () => import('@/views/AdminView.vue'),
          meta: { requiresRole: 'admin' },
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
  return true;
});

router.beforeResolve((to) => {
  const required = to.meta.requiresRole;
  if (!required) {
    return true;
  }
  const room = useCurrentRoomStore();
  const allowed = required === 'admin' ? room.isAdmin : room.isPlayer;
  return allowed ? true : { name: 'roster', params: { slug: roomSlug(to) } };
});

export default router;
