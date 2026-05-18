export interface AvatarGeneratorCardProps {
  onGenerate: (avatarData: any) => void;
  onCancel: () => void;
}

export interface AppearanceState {
  eyeColor?: string;
  hairColor?: string;
  skinTone?: string;
  emotion?: string;
}

export interface ClothingState {
  clothes?: string;
  glasses?: string;
  hat?: string;
  jewelry?: string;
}

export const eyeColors = [
  { value: "brown", label: "Brown" },
  { value: "blue", label: "Blue" },
  { value: "green", label: "Green" },
  { value: "hazel", label: "Hazel" },
  { value: "gray", label: "Gray" },
];

export const hairColors = [
  { value: "black", label: "Black" },
  { value: "brown", label: "Brown" },
  { value: "blonde", label: "Blonde" },
  { value: "red", label: "Red" },
  { value: "gray", label: "Gray" },
  { value: "white", label: "White" },
];

export const skinTones = [
  { value: "light", label: "Light" },
  { value: "medium-light", label: "Medium Light" },
  { value: "medium", label: "Medium" },
  { value: "medium-dark", label: "Medium Dark" },
  { value: "dark", label: "Dark" },
];

export const emotions = [
  { value: "happy", label: "Happy" },
  { value: "neutral", label: "Neutral" },
  { value: "confident", label: "Confident" },
  { value: "friendly", label: "Friendly" },
  { value: "professional", label: "Professional" },
];

export const clothes = [
  { value: "business", label: "Business" },
  { value: "casual", label: "Casual" },
  { value: "formal", label: "Formal" },
  { value: "smart-casual", label: "Smart Casual" },
  { value: "creative", label: "Creative" },
];

export const glasses = [
  { value: "none", label: "None" },
  { value: "reading", label: "Reading Glasses" },
  { value: "sunglasses", label: "Sunglasses" },
  { value: "modern", label: "Modern Frames" },
  { value: "vintage", label: "Vintage Frames" },
];

export const hats = [
  { value: "none", label: "None" },
  { value: "baseball", label: "Baseball Cap" },
  { value: "beanie", label: "Beanie" },
  { value: "fedora", label: "Fedora" },
  { value: "cowboy", label: "Cowboy Hat" },
];

export const jewelry = [
  { value: "none", label: "None" },
  { value: "watch", label: "Watch" },
  { value: "necklace", label: "Necklace" },
  { value: "earrings", label: "Earrings" },
  { value: "bracelet", label: "Bracelet" },
];

export const generateRandomAppearance = (): AppearanceState => {
  return {
    eyeColor: eyeColors[Math.floor(Math.random() * eyeColors.length)].value,
    hairColor: hairColors[Math.floor(Math.random() * hairColors.length)].value,
    skinTone: skinTones[Math.floor(Math.random() * skinTones.length)].value,
    emotion: emotions[Math.floor(Math.random() * emotions.length)].value,
  };
};

export const generateRandomClothing = (): ClothingState => {
  return {
    clothes: clothes[Math.floor(Math.random() * clothes.length)].value,
    glasses: glasses[Math.floor(Math.random() * glasses.length)].value,
    hat: hats[Math.floor(Math.random() * hats.length)].value,
    jewelry: jewelry[Math.floor(Math.random() * jewelry.length)].value,
  };
};

export const onAppearanceChange = (
  field: keyof AppearanceState,
  value: string,
  currentAppearance: AppearanceState,
  setAppearance: (appearance: AppearanceState) => void
) => {
  setAppearance({ ...currentAppearance, [field]: value });
};

export const onClothingChange = (
  field: keyof ClothingState,
  value: string,
  currentClothing: ClothingState,
  setClothing: (clothing: ClothingState) => void
) => {
  setClothing({ ...currentClothing, [field]: value });
};
