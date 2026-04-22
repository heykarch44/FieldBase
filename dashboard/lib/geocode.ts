// Geocoding utility using Nominatim (OpenStreetMap).
// No API key required. Rate limit: 1 request/sec.

export interface GeocodeInput {
  address_line1: string
  city?: string | null
  state?: string | null
  zip?: string | null
  country?: string | null
}

export interface GeocodeResult {
  lat: number
  lng: number
}

const USER_AGENT = 'FieldIQ/1.0 (support@fldiq.com)'

export async function geocodeAddress(
  input: GeocodeInput
): Promise<GeocodeResult | null> {
  if (!input.address_line1) return null

  const params = new URLSearchParams({
    format: 'json',
    street: input.address_line1,
    limit: '1',
    country: input.country ?? 'USA',
  })
  if (input.city) params.set('city', input.city)
  if (input.state) params.set('state', input.state)
  if (input.zip) params.set('postalcode', input.zip)

  const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
      },
    })
    if (!res.ok) return null
    const data = (await res.json()) as Array<{ lat: string; lon: string }>
    if (!Array.isArray(data) || data.length === 0) return null
    const lat = parseFloat(data[0].lat)
    const lng = parseFloat(data[0].lon)
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null
    return { lat, lng }
  } catch {
    return null
  }
}
