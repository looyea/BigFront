import { createRouter, createWebHistory } from 'vue-router';
import Home from './views/Home.vue';
import Package from './views/Package.vue';
import Lesson from './views/Lesson.vue';

const routes = [
  { path: '/', name: 'home', component: Home },
  { path: '/p/:pkgId', name: 'package', component: Package },
  { path: '/l/:pkgId/:lessonId', name: 'lesson', component: Lesson },
  { path: '/:pathMatch(.*)*', redirect: '/' },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
});
