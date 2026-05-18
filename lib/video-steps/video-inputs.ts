export type VideoInputBackground =
  | {
      type: "image";
      url: string;
    }
  | {
      type: "color";
      value: string;
    };

export interface PreviewVideoInput {
  type: "avatar";
  input_text: string;
  avatar_id: string;
  background: VideoInputBackground;
}

export interface HeygenVideoInput {
  character: {
    type: "avatar";
    avatar_id: string;
    avatar_style: "normal";
  };
  voice: {
    type: "text";
    input_text: string;
    voice_id: string;
  };
  background:
    | { type: "color"; value: string }
    | { type: "image"; image_url: string };
}

export const previewVideoInputs: PreviewVideoInput[] = [
  {
    type: "avatar",
    input_text: "Welcome!",
    avatar_id: "natalie_mk2_20240201",
    background: {
      type: "image",
      url: "https://example.com/background1.jpg",
    },
  },
  {
    type: "avatar",
    input_text: "Here is the next part.",
    avatar_id: "natalie_mk2_20240201",
    background: {
      type: "image",
      url: "https://example.com/background2.jpg",
    },
  },
  {
    type: "avatar",
    input_text: "And final scene.",
    avatar_id: "natalie_mk2_20240201",
    background: {
      type: "color",
      value: "#000000",
    },
  },
];

interface BuildOptions {
  defaultAvatarId: string;
  defaultVoiceId: string;
  fallbackColor: string;
}

export function buildHeygenVideoInputs({
  defaultAvatarId,
  defaultVoiceId,
  fallbackColor,
}: BuildOptions): HeygenVideoInput[] {
  if (!previewVideoInputs.length) {
    return [];
  }

  return previewVideoInputs.map((scene) => {
    const background =
      scene.background.type === "image"
        ? {
            type: "image" as const,
            image_url: scene.background.url,
          }
        : {
            type: "color" as const,
            value: scene.background.value || fallbackColor,
          };

    return {
      character: {
        type: "avatar",
        avatar_id: scene.avatar_id || defaultAvatarId,
        avatar_style: "normal",
      },
      voice: {
        type: "text",
        input_text: scene.input_text || "Placeholder text",
        voice_id: defaultVoiceId,
      },
      background,
    };
  });
}

