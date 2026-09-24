import { createRouter, createWebHistory } from 'vue-router';
import Home from './views/Home.vue';
import Package from './views/Package.vue';
import Lesson from './views/Lesson.vue';
import LessonPart from './views/LessonPart.vue';

const routes = [
  { path: '/', name: 'home', component: Home },
  { path: '/p/:pkgId', name: 'package', component: Package },
  { path: '/l/:pkgId/:lessonId', name: 'lesson', component: Lesson },
  // 小测 / 面试题 / 作业：从课文详情页摘出的三个独立视图
  { path: '/l/:pkgId/:lessonId/quiz', name: 'lesson-quiz', component: LessonPart },
  { path: '/l/:pkgId/:lessonId/interview', name: 'lesson-interview', component: LessonPart },
  { path: '/l/:pkgId/:lessonId/homework', name: 'lesson-homework', component: LessonPart },
  { path: '/:pathMatch(.*)*', redirect: '/' },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
});
