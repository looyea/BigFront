import { createRouter, createWebHistory } from 'vue-router';
import Home from './views/Home.vue';
import Package from './views/Package.vue';
import Lesson from './views/Lesson.vue';
import LessonPart from './views/LessonPart.vue';
import Glossary from './views/Glossary.vue';

const routes = [
  { path: '/', name: 'home', component: Home },
  { path: '/p/:pkgId', name: 'package', component: Package },
  { path: '/l/:pkgId/:lessonId', name: 'lesson', component: Lesson },
  // 小测 / 面试题 / 作业：从课文详情页摘出的三个独立视图
  { path: '/l/:pkgId/:lessonId/quiz', name: 'lesson-quiz', component: LessonPart },
  { path: '/l/:pkgId/:lessonId/interview', name: 'lesson-interview', component: LessonPart },
  { path: '/l/:pkgId/:lessonId/homework', name: 'lesson-homework', component: LessonPart },
  // 术语表：独立于进度与解锁的词典页，锚点 #term-<id> 供课文 Tooltip 直达
  { path: '/g/:pkgId', name: 'glossary', component: Glossary },
  { path: '/:pathMatch(.*)*', redirect: '/' },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
});
