import { useRoutes } from 'react-router-dom'
import { routes } from './router'
import GenerationIndicator from './features/generation/ui/GenerationIndicator'

function App() {
  const element = useRoutes(routes)

  return (
    <>
      {element}
      <GenerationIndicator />
    </>
  )
}

export default App
