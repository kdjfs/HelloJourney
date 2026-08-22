/* eslint-disable react-refresh/only-export-components -- route configuration is not a component module */
import { lazy, Suspense, type ReactNode } from 'react'
import type { RouteObject } from 'react-router-dom'
import { PageLoading } from '@/components/AsyncState'

const Landing = lazy(() => import('../pages/Landing'))
const Result = lazy(() => import('../pages/Result'))
const Settings = lazy(() => import('../pages/Settings'))

const deferred = (page: ReactNode) => <Suspense fallback={<PageLoading />}>{page}</Suspense>

export const routes: RouteObject[] = [
  {
    path: '/',
    element: deferred(<Landing />),
  },
  {
    path: '/result',
    element: deferred(<Result />),
  },
  {
    path: '/settings',
    element: deferred(<Settings />),
  },
]
