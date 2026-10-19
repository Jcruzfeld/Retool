import { useEffect } from 'react'

export default function App() {
  useEffect(() => {
    document.title = 'Test'
  }, [])

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <section className="w-full max-w-xl rounded-lg border bg-card p-8 text-center text-card-foreground shadow-retool-sm">
        <p className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Placeholder app
        </p>
        <h1 className="text-4xl font-bold tracking-tight">Test</h1>
        <p className="mt-4 text-base leading-7 text-body-foreground">
          This app is used to test GitHub source control.
        </p>
      </section>
    </main>
  )
}
