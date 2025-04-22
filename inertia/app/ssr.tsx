import ReactDOMServer from 'react-dom/server'
import { createInertiaApp } from '@inertiajs/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

export default function render(page: any) {
  const queryClient = new QueryClient()
  return createInertiaApp({
    page,
    render: ReactDOMServer.renderToString,
    resolve: (name) => {
      const pages = import.meta.glob('../pages/**/*.tsx', { eager: true })
      return pages[`../pages/${name}.tsx`]
    },

    setup: ({ App, props }) => (
      <QueryClientProvider client={queryClient}>
        <>
          <App {...props} />
          {/* Les devtools ne seront pas rendus côté serveur */}
          <ReactQueryDevtools initialIsOpen={false} />
        </>
      </QueryClientProvider>
    ),
  })
}
