import { createRouter, createWebHistory } from 'vue-router'
import ExpenseTracker from '@/components/ExpenseTracker.vue'
import AuthHandler from '@/components/AuthHandler.vue'

const routes = [
  {
    path: '/',
    name: 'Dashboard',
    component: ExpenseTracker,
    meta: { requiresAuth: true }
  },
  {
    path: '/auth',
    name: 'Auth',
    component: AuthHandler
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// Navigation guard
router.beforeEach((to, from, next) => {
  if (to.meta.requiresAuth) {
    const token = localStorage.getItem('expense_tracker_token')
    if (!token) {
      next('/auth')
    } else {
      next()
    }
  } else {
    next()
  }
})

export default router