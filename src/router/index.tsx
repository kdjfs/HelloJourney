import type { RouteObject } from 'react-router-dom'
import Landing from '../pages/Landing'
import Result from '../pages/Result'

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <Landing />,
  },
  {
    path: '/result',
    element: <Result />,
  },
]