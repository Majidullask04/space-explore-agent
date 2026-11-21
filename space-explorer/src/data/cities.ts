import type { Origin } from "./types"

export interface City {
  name: string
  country: string
  lat: number
  lng: number
  tz: string
}

export const CITIES: City[] = [
  { name: "Pasadena", country: "United States", lat: 34.1478, lng: -118.1445, tz: "America/Los_Angeles" },
  { name: "Los Angeles", country: "United States", lat: 34.0522, lng: -118.2437, tz: "America/Los_Angeles" },
  { name: "San Francisco", country: "United States", lat: 37.7749, lng: -122.4194, tz: "America/Los_Angeles" },
  { name: "Seattle", country: "United States", lat: 47.6062, lng: -122.3321, tz: "America/Los_Angeles" },
  { name: "Houston", country: "United States", lat: 29.7604, lng: -95.3698, tz: "America/Chicago" },
  { name: "Chicago", country: "United States", lat: 41.8781, lng: -87.6298, tz: "America/Chicago" },
  { name: "Austin", country: "United States", lat: 30.2672, lng: -97.7431, tz: "America/Chicago" },
  { name: "New York", country: "United States", lat: 40.7128, lng: -74.006, tz: "America/New_York" },
  { name: "Boston", country: "United States", lat: 42.3601, lng: -71.0589, tz: "America/New_York" },
  { name: "Washington, D.C.", country: "United States", lat: 38.9072, lng: -77.0369, tz: "America/New_York" },
  { name: "Miami", country: "United States", lat: 25.7617, lng: -80.1918, tz: "America/New_York" },
  { name: "Denver", country: "United States", lat: 39.7392, lng: -104.9903, tz: "America/Denver" },
  { name: "Phoenix", country: "United States", lat: 33.4484, lng: -112.074, tz: "America/Phoenix" },
  { name: "Toronto", country: "Canada", lat: 43.6532, lng: -79.3832, tz: "America/Toronto" },
  { name: "Vancouver", country: "Canada", lat: 49.2827, lng: -123.1207, tz: "America/Vancouver" },
  { name: "Montreal", country: "Canada", lat: 45.5017, lng: -73.5673, tz: "America/Toronto" },
  { name: "Mexico City", country: "Mexico", lat: 19.4326, lng: -99.1332, tz: "America/Mexico_City" },
  { name: "São Paulo", country: "Brazil", lat: -23.5505, lng: -46.6333, tz: "America/Sao_Paulo" },
  { name: "Buenos Aires", country: "Argentina", lat: -34.6037, lng: -58.3816, tz: "America/Argentina/Buenos_Aires" },
  { name: "Santiago", country: "Chile", lat: -33.4489, lng: -70.6693, tz: "America/Santiago" },
  { name: "Lima", country: "Peru", lat: -12.0464, lng: -77.0428, tz: "America/Lima" },
  { name: "Bogotá", country: "Colombia", lat: 4.711, lng: -74.0721, tz: "America/Bogota" },
  { name: "London", country: "United Kingdom", lat: 51.5072, lng: -0.1276, tz: "Europe/London" },
  { name: "Paris", country: "France", lat: 48.8566, lng: 2.3522, tz: "Europe/Paris" },
  { name: "Berlin", country: "Germany", lat: 52.52, lng: 13.405, tz: "Europe/Berlin" },
  { name: "Munich", country: "Germany", lat: 48.1351, lng: 11.582, tz: "Europe/Berlin" },
  { name: "Amsterdam", country: "Netherlands", lat: 52.3676, lng: 4.9041, tz: "Europe/Amsterdam" },
  { name: "Brussels", country: "Belgium", lat: 50.8503, lng: 4.3517, tz: "Europe/Brussels" },
  { name: "Zurich", country: "Switzerland", lat: 47.3769, lng: 8.5417, tz: "Europe/Zurich" },
  { name: "Madrid", country: "Spain", lat: 40.4168, lng: -3.7038, tz: "Europe/Madrid" },
  { name: "Barcelona", country: "Spain", lat: 41.3874, lng: 2.1686, tz: "Europe/Madrid" },
  { name: "Rome", country: "Italy", lat: 41.9028, lng: 12.4964, tz: "Europe/Rome" },
  { name: "Milan", country: "Italy", lat: 45.4642, lng: 9.19, tz: "Europe/Rome" },
  { name: "Vienna", country: "Austria", lat: 48.2082, lng: 16.3738, tz: "Europe/Vienna" },
  { name: "Stockholm", country: "Sweden", lat: 59.3293, lng: 18.0686, tz: "Europe/Stockholm" },
  { name: "Oslo", country: "Norway", lat: 59.9139, lng: 10.7522, tz: "Europe/Oslo" },
  { name: "Copenhagen", country: "Denmark", lat: 55.6761, lng: 12.5683, tz: "Europe/Copenhagen" },
  { name: "Helsinki", country: "Finland", lat: 60.1699, lng: 24.9384, tz: "Europe/Helsinki" },
  { name: "Dublin", country: "Ireland", lat: 53.3498, lng: -6.2603, tz: "Europe/Dublin" },
  { name: "Lisbon", country: "Portugal", lat: 38.7223, lng: -9.1393, tz: "Europe/Lisbon" },
  { name: "Warsaw", country: "Poland", lat: 52.2297, lng: 21.0122, tz: "Europe/Warsaw" },
  { name: "Prague", country: "Czechia", lat: 50.0755, lng: 14.4378, tz: "Europe/Prague" },
  { name: "Athens", country: "Greece", lat: 37.9838, lng: 23.7275, tz: "Europe/Athens" },
  { name: "Istanbul", country: "Türkiye", lat: 41.0082, lng: 28.9784, tz: "Europe/Istanbul" },
  { name: "Moscow", country: "Russia", lat: 55.7558, lng: 37.6173, tz: "Europe/Moscow" },
  { name: "Kyiv", country: "Ukraine", lat: 50.4501, lng: 30.5234, tz: "Europe/Kyiv" },
  { name: "Cairo", country: "Egypt", lat: 30.0444, lng: 31.2357, tz: "Africa/Cairo" },
  { name: "Lagos", country: "Nigeria", lat: 6.5244, lng: 3.3792, tz: "Africa/Lagos" },
  { name: "Nairobi", country: "Kenya", lat: -1.2921, lng: 36.8219, tz: "Africa/Nairobi" },
  { name: "Johannesburg", country: "South Africa", lat: -26.2041, lng: 28.0473, tz: "Africa/Johannesburg" },
  { name: "Cape Town", country: "South Africa", lat: -33.9249, lng: 18.4241, tz: "Africa/Johannesburg" },
  { name: "Casablanca", country: "Morocco", lat: 33.5731, lng: -7.5898, tz: "Africa/Casablanca" },
  { name: "Dubai", country: "United Arab Emirates", lat: 25.2048, lng: 55.2708, tz: "Asia/Dubai" },
  { name: "Abu Dhabi", country: "United Arab Emirates", lat: 24.4539, lng: 54.3773, tz: "Asia/Dubai" },
  { name: "Riyadh", country: "Saudi Arabia", lat: 24.7136, lng: 46.6753, tz: "Asia/Riyadh" },
  { name: "Doha", country: "Qatar", lat: 25.2854, lng: 51.531, tz: "Asia/Qatar" },
  { name: "Tehran", country: "Iran", lat: 35.6892, lng: 51.389, tz: "Asia/Tehran" },
  { name: "Karachi", country: "Pakistan", lat: 24.8607, lng: 67.0011, tz: "Asia/Karachi" },
  { name: "Lahore", country: "Pakistan", lat: 31.5204, lng: 74.3587, tz: "Asia/Karachi" },
  { name: "Islamabad", country: "Pakistan", lat: 33.6844, lng: 73.0479, tz: "Asia/Karachi" },
  { name: "Delhi", country: "India", lat: 28.6139, lng: 77.209, tz: "Asia/Kolkata" },
  { name: "Mumbai", country: "India", lat: 19.076, lng: 72.8777, tz: "Asia/Kolkata" },
  { name: "Bengaluru", country: "India", lat: 12.9716, lng: 77.5946, tz: "Asia/Kolkata" },
  { name: "Chennai", country: "India", lat: 13.0827, lng: 80.2707, tz: "Asia/Kolkata" },
  { name: "Kolkata", country: "India", lat: 22.5726, lng: 88.3639, tz: "Asia/Kolkata" },
  { name: "Dhaka", country: "Bangladesh", lat: 23.8103, lng: 90.4125, tz: "Asia/Dhaka" },
  { name: "Kathmandu", country: "Nepal", lat: 27.7172, lng: 85.324, tz: "Asia/Kathmandu" },
  { name: "Colombo", country: "Sri Lanka", lat: 6.9271, lng: 79.8612, tz: "Asia/Colombo" },
  { name: "Bangkok", country: "Thailand", lat: 13.7563, lng: 100.5018, tz: "Asia/Bangkok" },
  { name: "Singapore", country: "Singapore", lat: 1.3521, lng: 103.8198, tz: "Asia/Singapore" },
  { name: "Kuala Lumpur", country: "Malaysia", lat: 3.139, lng: 101.6869, tz: "Asia/Kuala_Lumpur" },
  { name: "Jakarta", country: "Indonesia", lat: -6.2088, lng: 106.8456, tz: "Asia/Jakarta" },
  { name: "Manila", country: "Philippines", lat: 14.5995, lng: 120.9842, tz: "Asia/Manila" },
  { name: "Hanoi", country: "Vietnam", lat: 21.0278, lng: 105.8342, tz: "Asia/Ho_Chi_Minh" },
  { name: "Hong Kong", country: "China", lat: 22.3193, lng: 114.1694, tz: "Asia/Hong_Kong" },
  { name: "Shanghai", country: "China", lat: 31.2304, lng: 121.4737, tz: "Asia/Shanghai" },
  { name: "Beijing", country: "China", lat: 39.9042, lng: 116.4074, tz: "Asia/Shanghai" },
  { name: "Seoul", country: "South Korea", lat: 37.5665, lng: 126.978, tz: "Asia/Seoul" },
  { name: "Tokyo", country: "Japan", lat: 35.6762, lng: 139.6503, tz: "Asia/Tokyo" },
  { name: "Osaka", country: "Japan", lat: 34.6937, lng: 135.5023, tz: "Asia/Tokyo" },
  { name: "Taipei", country: "Taiwan", lat: 25.033, lng: 121.5654, tz: "Asia/Taipei" },
  { name: "Sydney", country: "Australia", lat: -33.8688, lng: 151.2093, tz: "Australia/Sydney" },
  { name: "Melbourne", country: "Australia", lat: -37.8136, lng: 144.9631, tz: "Australia/Melbourne" },
  { name: "Brisbane", country: "Australia", lat: -27.4698, lng: 153.0251, tz: "Australia/Brisbane" },
  { name: "Perth", country: "Australia", lat: -31.9523, lng: 115.8613, tz: "Australia/Perth" },
  { name: "Auckland", country: "New Zealand", lat: -36.8509, lng: 174.7645, tz: "Pacific/Auckland" },
  { name: "Honolulu", country: "United States", lat: 21.3069, lng: -157.8583, tz: "Pacific/Honolulu" },
  { name: "Anchorage", country: "United States", lat: 61.2181, lng: -149.9003, tz: "America/Anchorage" },
  { name: "Reykjavik", country: "Iceland", lat: 64.1466, lng: -21.9426, tz: "Atlantic/Reykjavik" },
]

const TZ_CITY: Record<string, string> = {
  "America/Los_Angeles": "Pasadena",
  "America/Denver": "Denver",
  "America/Phoenix": "Phoenix",
  "America/Chicago": "Chicago",
  "America/New_York": "New York",
  "America/Toronto": "Toronto",
  "America/Vancouver": "Vancouver",
  "America/Mexico_City": "Mexico City",
  "America/Sao_Paulo": "São Paulo",
  "America/Argentina/Buenos_Aires": "Buenos Aires",
  "America/Santiago": "Santiago",
  "America/Lima": "Lima",
  "America/Bogota": "Bogotá",
  "Europe/London": "London",
  "Europe/Paris": "Paris",
  "Europe/Berlin": "Berlin",
  "Europe/Amsterdam": "Amsterdam",
  "Europe/Madrid": "Madrid",
  "Europe/Rome": "Rome",
  "Europe/Vienna": "Vienna",
  "Europe/Stockholm": "Stockholm",
  "Europe/Oslo": "Oslo",
  "Europe/Copenhagen": "Copenhagen",
  "Europe/Helsinki": "Helsinki",
  "Europe/Dublin": "Dublin",
  "Europe/Lisbon": "Lisbon",
  "Europe/Warsaw": "Warsaw",
  "Europe/Prague": "Prague",
  "Europe/Athens": "Athens",
  "Europe/Istanbul": "Istanbul",
  "Europe/Moscow": "Moscow",
  "Europe/Kyiv": "Kyiv",
  "Africa/Cairo": "Cairo",
  "Africa/Lagos": "Lagos",
  "Africa/Nairobi": "Nairobi",
  "Africa/Johannesburg": "Johannesburg",
  "Africa/Casablanca": "Casablanca",
  "Asia/Dubai": "Dubai",
  "Asia/Riyadh": "Riyadh",
  "Asia/Qatar": "Doha",
  "Asia/Tehran": "Tehran",
  "Asia/Karachi": "Lahore",
  "Asia/Kolkata": "Delhi",
  "Asia/Dhaka": "Dhaka",
  "Asia/Kathmandu": "Kathmandu",
  "Asia/Colombo": "Colombo",
  "Asia/Bangkok": "Bangkok",
  "Asia/Singapore": "Singapore",
  "Asia/Kuala_Lumpur": "Kuala Lumpur",
  "Asia/Jakarta": "Jakarta",
  "Asia/Manila": "Manila",
  "Asia/Ho_Chi_Minh": "Hanoi",
  "Asia/Hong_Kong": "Hong Kong",
  "Asia/Shanghai": "Shanghai",
  "Asia/Seoul": "Seoul",
  "Asia/Tokyo": "Tokyo",
  "Asia/Taipei": "Taipei",
  "Australia/Sydney": "Sydney",
  "Australia/Melbourne": "Melbourne",
  "Australia/Brisbane": "Brisbane",
  "Australia/Perth": "Perth",
  "Pacific/Auckland": "Auckland",
  "Pacific/Honolulu": "Honolulu",
  "America/Anchorage": "Anchorage",
  "Atlantic/Reykjavik": "Reykjavik",
}

export function originFromTimezone(): Origin {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  const city = CITIES.find((c) => c.name === TZ_CITY[tz])
  if (city) {
    return { lat: city.lat, lng: city.lng, label: city.name, source: "timezone" }
  }
  return { lat: 34.1478, lng: -118.1445, label: "Pasadena", source: "default" }
}

export function searchCities(query: string): City[] {
  const q = query.trim().toLowerCase()
  if (!q) return CITIES.slice(0, 8)
  return CITIES.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      c.country.toLowerCase().includes(q) ||
      c.tz.toLowerCase().includes(q),
  ).slice(0, 8)
}

export function parseCoordinates(input: string): { lat: number; lng: number } | null {
  const m = input
    .trim()
    .match(/^(-?\d{1,2}(?:\.\d+)?)\s*[, ]\s*(-?\d{1,3}(?:\.\d+)?)$/)
  if (!m) return null
  const lat = Number(m[1])
  const lng = Number(m[2])
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return { lat, lng }
}
