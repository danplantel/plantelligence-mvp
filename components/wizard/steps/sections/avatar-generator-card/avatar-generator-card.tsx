"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RefreshCw } from "lucide-react";
import {
  AvatarGeneratorCardProps,
  AppearanceState,
  ClothingState,
  eyeColors,
  hairColors,
  skinTones,
  emotions,
  clothes,
  glasses,
  hats,
  jewelry,
  generateRandomAppearance,
  generateRandomClothing,
  onAppearanceChange,
  onClothingChange,
} from "./avatar-generator-card.funcs";

export function AvatarGeneratorCard({
  onGenerate,
  onCancel,
}: AvatarGeneratorCardProps) {
  const [appearance, setAppearance] = useState<AppearanceState>({
    eyeColor: undefined,
    hairColor: undefined,
    skinTone: undefined,
    emotion: undefined,
  });

  const [clothing, setClothing] = useState<ClothingState>({
    clothes: undefined,
    glasses: undefined,
    hat: undefined,
    jewelry: undefined,
  });

  const onRandomize = () => {
    const randomAppearance = generateRandomAppearance();
    const randomClothing = generateRandomClothing();

    setAppearance(randomAppearance);
    setClothing(randomClothing);
  };

  const onGenerateClick = () => {};

  return (
    <Card className="shadow-none h-full flex flex-col">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl">Generating Avatar</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={onRandomize}
            className="flex items-center space-x-1"
          >
            <span>Random</span>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-1">
        {/* Content */}
        <div className="grid grid-cols-2 gap-6">
          {/* Appearance Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Appearance</h3>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Eye Color
                </label>
                <Select
                  value={appearance.eyeColor}
                  onValueChange={(value) =>
                    onAppearanceChange(
                      "eyeColor",
                      value,
                      appearance,
                      setAppearance,
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose eye color" />
                  </SelectTrigger>
                  <SelectContent>
                    {eyeColors.map((color) => (
                      <SelectItem key={color.value} value={color.value}>
                        {color.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Hair Color
                </label>
                <Select
                  value={appearance.hairColor}
                  onValueChange={(value) =>
                    onAppearanceChange(
                      "hairColor",
                      value,
                      appearance,
                      setAppearance,
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose hair color" />
                  </SelectTrigger>
                  <SelectContent>
                    {hairColors.map((color) => (
                      <SelectItem key={color.value} value={color.value}>
                        {color.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Skin Tone
                </label>
                <Select
                  value={appearance.skinTone}
                  onValueChange={(value) =>
                    onAppearanceChange(
                      "skinTone",
                      value,
                      appearance,
                      setAppearance,
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose skin tone" />
                  </SelectTrigger>
                  <SelectContent>
                    {skinTones.map((tone) => (
                      <SelectItem key={tone.value} value={tone.value}>
                        {tone.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Emotion
                </label>
                <Select
                  value={appearance.emotion}
                  onValueChange={(value) =>
                    onAppearanceChange(
                      "emotion",
                      value,
                      appearance,
                      setAppearance,
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose emotion" />
                  </SelectTrigger>
                  <SelectContent>
                    {emotions.map((emotion) => (
                      <SelectItem key={emotion.value} value={emotion.value}>
                        {emotion.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Clothing and Accessories Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Clothing and accessories</h3>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Clothes
                </label>
                <Select
                  value={clothing.clothes}
                  onValueChange={(value) =>
                    onClothingChange("clothes", value, clothing, setClothing)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose clothes" />
                  </SelectTrigger>
                  <SelectContent>
                    {clothes.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Glasses
                </label>
                <Select
                  value={clothing.glasses}
                  onValueChange={(value) =>
                    onClothingChange("glasses", value, clothing, setClothing)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose glasses" />
                  </SelectTrigger>
                  <SelectContent>
                    {glasses.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Hat
                </label>
                <Select
                  value={clothing.hat}
                  onValueChange={(value) =>
                    onClothingChange("hat", value, clothing, setClothing)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose hat" />
                  </SelectTrigger>
                  <SelectContent>
                    {hats.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Jewelry
                </label>
                <Select
                  value={clothing.jewelry}
                  onValueChange={(value) =>
                    onClothingChange("jewelry", value, clothing, setClothing)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose jewelry" />
                  </SelectTrigger>
                  <SelectContent>
                    {jewelry.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex mt-6 pt-4 gap-4">
          <Button
            onClick={onGenerateClick}
            className="bg-accent-blue hover:bg-accent-blue px-5 text-base"
          >
            Generate
          </Button>
          <Button
            className="px-5 text-base text-accent-blue border-accent-blue"
            variant="outline"
            onClick={onCancel}
          >
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
