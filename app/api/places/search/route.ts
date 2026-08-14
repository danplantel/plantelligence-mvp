export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

/**
 * Non-business place types that represent physical addresses / locations.
 * Places Autocomplete with `types=address` already biases predictions to
 * addresses; this set is a defensive guard against the rare POI that slips
 * through (and keeps the "addresses, not businesses" intent).
 */
const ADDRESS_TYPES = new Set([
  "street_address",
  "premise",
  "subpremise",
  "route",
  "intersection",
  "neighborhood",
  "sublocality",
  "sublocality_level_1",
  "sublocality_level_2",
  "sublocality_level_3",
  "sublocality_level_4",
  "locality",
  "administrative_area_level_1",
  "administrative_area_level_2",
  "administrative_area_level_3",
  "administrative_area_level_4",
  "postal_code",
  "country",
  "political",
  "geocode",
  "address",
]);

/**
 * True when a place's address components indicate the United States.
 * `components=country:us` already restricts autocomplete to the US, so places
 * without a country component are treated as US (no data to contradict it).
 */
function isUsAddress(place: any): boolean {
  const components = place?.address_components || [];
  const country = components.find(
    (c: any) => Array.isArray(c.types) && c.types.includes("country"),
  );
  if (!country) return true;
  return String(country.short_name).toUpperCase() === "US";
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query");

    if (!query) {
      return NextResponse.json({ error: "Query parameter is required" }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Google Places API key not configured" }, { status: 500 });
    }

    // 1. Places Autocomplete (types=address) — purpose-built for address entry,
    // returns street-address predictions as the user types (Text Search is
    // business/POI-biased and drops most raw address queries).
    // `components=country:us` restricts the autocomplete suggestions to the
    // United States (meetings are US-only, so no international addresses).
    const autocompleteRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
        query,
      )}&types=address&components=country:us&key=${apiKey}`,
    );
    if (!autocompleteRes.ok) {
      throw new Error(`Google Places API error: ${autocompleteRes.status}`);
    }
    const autocompleteData = await autocompleteRes.json();
    if (
      autocompleteData.status !== "OK" &&
      autocompleteData.status !== "ZERO_RESULTS"
    ) {
      throw new Error(`Google Places API error: ${autocompleteData.status}`);
    }

    const predictions = (autocompleteData.predictions || []).slice(0, 5);
    console.log(
      `[places-search] autocomplete status=${autocompleteData.status} predictions=${predictions.length} query="${query}"`,
    );

    const results: any[] = [];

    for (const prediction of predictions) {
      let place: any = null;
      try {
        // 2. Enrich with full details (formatted_address, address_components,
        //    geometry) so the client can parse city/state/zip and capture lat/lng.
        const detailsRes = await fetch(
          `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(
            prediction.place_id,
          )}&fields=formatted_address,address_components,geometry&key=${apiKey}`,
        );
        const detailsData = await detailsRes.json();
        if (detailsData.status === "OK" && detailsData.result) {
          place = detailsData.result;
        } else {
          console.warn(
            `[places-search] details skipped place_id=${prediction.place_id} status=${detailsData.status}`,
          );
        }
      } catch (err) {
        console.warn(
          `[places-search] details failed place_id=${prediction.place_id}`,
          err instanceof Error ? err.message : err,
        );
      }

      const types: string[] = place?.types || [];
      const isAddress =
        place &&
        types.some((t) => ADDRESS_TYPES.has(t)) &&
        isUsAddress(place);

      if (isAddress) {
        results.push({
          formatted_address: place.formatted_address,
          address_components: place.address_components || [],
          geometry: place.geometry || null,
          place_id: prediction.place_id,
        });
      } else {
        // Fallback: the autocomplete prediction description is already a valid
        // address string — return it so address results always appear even if
        // Place Details is unavailable (missing permission/quota on the key).
        results.push({
          formatted_address:
            prediction.description ||
            prediction.structured_formatting?.main_text ||
            "",
          address_components: [],
          geometry: null,
          place_id: prediction.place_id,
        });
      }
    }

    console.log(`[places-search] returning ${results.length} result(s)`);
    return NextResponse.json({
      results,
      status: autocompleteData.status,
    });
  } catch (error) {
    console.error("Error searching places:", error);
    return NextResponse.json(
      { error: "Failed to search places", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
