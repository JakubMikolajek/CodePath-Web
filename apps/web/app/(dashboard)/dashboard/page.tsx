'use server'

export default async function Page() {

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">Detailed analytics and insights</p>
        </div>
      </div>
    </>
  )
}

