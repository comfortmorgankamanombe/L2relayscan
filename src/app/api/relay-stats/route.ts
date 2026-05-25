import { fetchDashboardData } from "@/lib/fetch-relays"

export const runtime = "nodejs"

export async function GET() {
  try {
    const data = await fetchDashboardData()
    
    return Response.json(data, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "CDN-Cache-Control": "no-store",
      },
    })
  } catch (error) {
    console.error("Error fetching relay stats:", error)
    return Response.json(
      { error: "Failed to fetch relay stats" },
      { status: 500 }
    )
  }
}
