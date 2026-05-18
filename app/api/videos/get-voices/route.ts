import { NextResponse } from "next/server";
import axios from "axios";
import { HEYGEN_API_KEY } from "@/constants/app";

export const dynamic = 'force-dynamic';

// Recommended ElevenLabs voice IDs that definitely work with HeyGen
const RECOMMENDED_ELEVENLABS_VOICES = [
  "elevenlabs-premium-01",
  "elevenlabs-premium-02",
  "elevenlabs-professional-01",
  "elevenlabs-professional-02",
];

export async function GET() {
  try {
    const apiKey = HEYGEN_API_KEY || process.env.HEYGEN_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json(
        { error: "HeyGen API key is not configured" },
        { status: 500 },
      );
    }

    
    const response = await axios.get(
      "https://api.heygen.com/v2/voices",
      {
        headers: {
          "X-Api-Key": apiKey,
          "Accept": "application/json",
        },
      },
    );

    
    const allVoices = response.data?.data?.voices || [];

    // Log first voice structure to debug
    if (allVoices.length > 0) {
    }

    // Filter voices by provider: "ELEVENLABS" if provider field exists
    // Since provider field might not exist in API response, we'll show all voices
    // but try to identify ElevenLabs voices by various methods
    const elevenlabsVoices = allVoices.filter((voice: any) => {
      // Check if provider field exists and equals "ELEVENLABS" (case insensitive)
      if (voice.provider && voice.provider.toUpperCase() === "ELEVENLABS") {
        return true;
      }
      // Check if voice_id contains "elevenlabs" (case insensitive)
      if (voice.voice_id && voice.voice_id.toLowerCase().includes("elevenlabs")) {
        return true;
      }
      // Check if name contains "elevenlabs" (case insensitive)
      if (voice.name && voice.name.toLowerCase().includes("elevenlabs")) {
        return true;
      }
      return false;
    });

    
    // Since provider field might not exist in API response,
    // show ALL voices but prioritize recommended ElevenLabs voices
    // This allows users to select any voice, but recommended ones appear first
    const voicesToShow = allVoices; // Always show all voices

    // Prioritize recommended voices - put them first
    const recommendedVoices = voicesToShow.filter((voice: any) =>
      RECOMMENDED_ELEVENLABS_VOICES.includes(voice.voice_id)
    );
    
    const otherVoices = voicesToShow.filter(
      (voice: any) => !RECOMMENDED_ELEVENLABS_VOICES.includes(voice.voice_id)
    );

    // Combine: recommended first, then others
    const sortedVoices = [...recommendedVoices, ...otherVoices];
    

    return NextResponse.json({
      success: true,
      data: {
        voices: sortedVoices,
        total: sortedVoices.length,
        recommended: recommendedVoices.length,
      },
      // Also return all voices for reference
      allVoices: allVoices,
    });
  } catch (error: any) {
    console.error("Error fetching HeyGen voices:", error);
    
    const errorMessage =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Error fetching voices";
    
    return NextResponse.json(
      {
        error: errorMessage,
        details: error.response?.data,
      },
      { status: error.response?.status || 500 },
    );
  }
}

