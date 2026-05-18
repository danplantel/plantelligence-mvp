"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDebounce } from "@/hooks/useDebounce";

interface AddressSearchProps {
  value: string;
  onChange: (address: string) => void;
  onLocationSelect?: (location: {
    address: string;
    city: string;
    state: string;
    zip: string;
    lat?: number;
    lng?: number;
  }) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

interface PlaceResult {
  formatted_address: string;
  address_components: Array<{
    long_name: string;
    short_name: string;
    types: string[];
  }>;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
}

export function AddressSearch({
  value,
  onChange,
  onLocationSelect,
  placeholder = "Search for address...",
  disabled = false,
  className,
}: AddressSearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<PlaceResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState(value);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce search term to avoid too many API calls
  const debouncedSearchTerm = useDebounce(searchTerm, 500); // 500ms delay

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Search for places using Google Places API
  const searchPlaces = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 3) {
      setSuggestions([]);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/places/search?query=${encodeURIComponent(query)}`,
      );
      if (response.ok) {
        const data = await response.json();
        setSuggestions(data.results || []);
      }
    } catch (error) {
      console.error("Error searching places:", error);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Trigger search when debounced search term changes
  useEffect(() => {
    if (debouncedSearchTerm.length >= 3) {
      setIsOpen(true);
      searchPlaces(debouncedSearchTerm);
    } else {
      setIsOpen(false);
      setSuggestions([]);
    }
  }, [debouncedSearchTerm, searchPlaces]);

  // Handle input change (debounced search will trigger automatically)
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearchTerm(newValue);
    onChange(newValue);

    // Show loading state immediately if length >= 3
    if (newValue.length >= 3) {
      setIsLoading(true);
    } else {
      setIsOpen(false);
      setSuggestions([]);
    }
  };

  // Handle place selection
  const handlePlaceSelect = (place: PlaceResult) => {
    const address = place.formatted_address;
    setSearchTerm(address);
    onChange(address);
    setIsOpen(false);

    // Parse address components
    const components = place.address_components;
    const city =
      components.find((c) => c.types.includes("locality"))?.long_name || "";
    const state =
      components.find((c) => c.types.includes("administrative_area_level_1"))
        ?.long_name || "";
    const zip =
      components.find((c) => c.types.includes("postal_code"))?.long_name || "";

    if (onLocationSelect) {
      onLocationSelect({
        address,
        city,
        state,
        zip,
        lat: place.geometry.location.lat,
        lng: place.geometry.location.lng,
      });
    }
  };

  // Format address for display
  const formatAddress = (place: PlaceResult) => {
    return place.formatted_address;
  };

  return (
    <div className={cn("relative", className)} ref={dropdownRef}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          ref={inputRef}
          value={searchTerm}
          onChange={handleInputChange}
          placeholder={placeholder}
          disabled={disabled}
          className="pl-10"
          onFocus={() => {
            if (suggestions.length > 0) {
              setIsOpen(true);
            }
          }}
        />
      </div>

      {/* Dropdown with suggestions */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {isLoading ? (
            <div className="p-3 text-center text-sm text-gray-500">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900 mx-auto"></div>
              <div className="mt-2">Searching...</div>
            </div>
          ) : suggestions.length > 0 ? (
            <div className="py-1">
              {suggestions.map((place, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => handlePlaceSelect(place)}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 focus:bg-gray-100 focus:outline-none flex items-start gap-2"
                >
                  <MapPin className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 truncate">
                      {formatAddress(place)}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : searchTerm.length >= 3 ? (
            <div className="p-3 text-center text-sm text-gray-500">
              No addresses found
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
