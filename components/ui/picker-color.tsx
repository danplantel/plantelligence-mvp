import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMemo, useState } from "react";

interface PickerColorProps {
  color: string;
  onChange: (color: string) => void;
}

const PickerColor = ({ color, onChange }: PickerColorProps) => {
  const [background, setBackground] = useState(color || "#000000"); // Ensuring black is default

  const handleChange = (newColor: string) => {
    setBackground(newColor);
    onChange(newColor);
  };

  return <GradientPicker background={background} setBackground={handleChange} />;
};

const GradientPicker = ({
  background,
  setBackground,
  className,
}: {
  background: string;
  setBackground: (background: string) => void;
  className?: string;
}) => {
  const solids = [
    "#000000", // Black
    "#FF0000", // Red
    "#FF7F00", // Orange
    "#FFFF00", // Yellow
    "#00FF00", // Green
    "#0000FF", // Blue
    "#4B0082", // Indigo
    "#9400D3", // Violet
  ];

  const gradients = [
    "linear-gradient(to right, #ff7f00, #ff0000)", // Orange to Red
    "linear-gradient(to right, #00ff00, #0000ff)", // Green to Blue
    "linear-gradient(to right, #ffff00, #ff7f00)", // Yellow to Orange
    "linear-gradient(to right, #9400d3, #4b0082)", // Violet to Indigo
    "linear-gradient(to left, #34e89e, #0f3443)", // Teal to Deep Blue
    "linear-gradient(to bottom, #eecda3, #ef629f)", // Peach to Pink
    "linear-gradient(to right, #a8ff78, #78ffd6)", // Lime to Aqua
    "linear-gradient(to left, #f7971e, #ffd200)", // Orange to Yellow
  ];

  const defaultTab = useMemo(() => "solid", []);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant={"outline"} className={className}>
          <div className="flex items-center w-full gap-2">
            <div
              className="h-4 w-4 rounded !bg-cover !bg-center transition-all"
              style={{ background: background, backgroundImage: background.includes('gradient') ? background : 'none' }}
            ></div>
            <div className="flex-1 truncate">{background}</div>
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64">
        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="w-full mb-4">
            <TabsTrigger className="flex-1" value="solid">
              Solid
            </TabsTrigger>
            <TabsTrigger className="flex-1" value="gradient">
              Gradient
            </TabsTrigger>
          </TabsList>

          <TabsContent value="solid" className="flex flex-wrap gap-1 mt-0">
            {solids.map((s) => (
              <div
                key={s}
                style={{ background: s }}
                className="w-6 h-6 rounded-md cursor-pointer active:scale-105"
                onClick={() => setBackground(s)}
              />
            ))}
          </TabsContent>

          <TabsContent value="gradient" className="flex flex-wrap gap-1 mt-0">
            {gradients.map((g) => (
              <div
                key={g}
                style={{ backgroundImage: g }}
                className="w-6 h-6 rounded-md cursor-pointer active:scale-105"
                onClick={() => setBackground(g)}
              />
            ))}
          </TabsContent>
        </Tabs>

        <Input
          id="custom"
          value={background}
          className="h-8 col-span-2 mt-4"
          onChange={(e) => setBackground(e.currentTarget.value)}
        />
      </PopoverContent>
    </Popover>
  );
};

export { PickerColor };
