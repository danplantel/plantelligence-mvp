"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Image as ImageIcon,
  Type,
  User,
  Upload,
  Loader2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

interface TemplateVariable {
  name: string;
  type: "text" | "image" | "avatar" | "video" | "audio";
  properties: any;
}

interface TemplateEditorProps {
  templateId: string;
  templateData: Record<string, any>;
  onTemplateDataChange: (data: Record<string, any>) => void;
  avatarId?: string;
  onAvatarChange?: (avatarId: string) => void;
}

export function TemplateEditor({
  templateId,
  templateData,
  onTemplateDataChange,
  avatarId,
  onAvatarChange,
}: TemplateEditorProps) {
  const [variables, setVariables] = useState<Record<string, TemplateVariable>>(
    {},
  );
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("text");
  const [editingData, setEditingData] = useState<Record<string, any>>(
    templateData || {},
  );
  const [uploadingImage, setUploadingImage] = useState<string | null>(null);

  // Fetch template details to get available variables
  useEffect(() => {
    const fetchTemplateDetails = async () => {
      if (!templateId) return;

      setIsLoading(true);
      try {
        const response = await fetch(`/api/heygen/templates/${templateId}`);
        const result = await response.json();

        if (result.success && result.data.variables) {
          setVariables(result.data.variables);
        }
      } catch (error) {
        console.error("Error fetching template details:", error);
        toast.error("Failed to load template details");
      } finally {
        setIsLoading(false);
      }
    };

    fetchTemplateDetails();
  }, [templateId]);

  const handleTextChange = (variableName: string, value: string) => {
    const updated = {
      ...editingData,
      [variableName]: value,
    };
    setEditingData(updated);
    onTemplateDataChange(updated);
  };

  const handleImageUpload = async (variableName: string, file: File) => {
    setUploadingImage(variableName);
    try {
      // Upload to template image endpoint
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload-template-image", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const result = await response.json();

      // Convert relative URL to absolute if needed
      const imageUrl = result.url.startsWith("http")
        ? result.url
        : `${window.location.origin}${result.url}`;

      const updated = {
        ...editingData,
        [variableName]: imageUrl,
      };
      setEditingData(updated);
      onTemplateDataChange(updated);

      toast.success("Image uploaded successfully");
    } catch (error) {
      console.error("Error uploading image:", error);
      toast.error("Failed to upload image");
    } finally {
      setUploadingImage(null);
    }
  };

  const handleImageUrlChange = (variableName: string, url: string) => {
    const updated = {
      ...editingData,
      [variableName]: url,
    };
    setEditingData(updated);
    onTemplateDataChange(updated);
  };

  const handleRemoveImage = (variableName: string) => {
    const updated = {
      ...editingData,
      [variableName]: "",
    };
    setEditingData(updated);
    onTemplateDataChange(updated);
  };

  const renderTextVariables = () => {
    const textVars = Object.entries(variables).filter(
      ([, v]) => v.type === "text",
    );

    if (textVars.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          No text variables found in this template
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {textVars.map(([name, variable]) => (
          <div key={name} className="space-y-2">
            <Label htmlFor={name} className="text-sm font-medium">
              {name.replace(/_/g, " ").toUpperCase()}
            </Label>
            {name.includes("description") ||
            name.includes("disclaimer") ||
            name.includes("detail") ? (
              <Textarea
                id={name}
                value={editingData[name] || ""}
                onChange={(e) => handleTextChange(name, e.target.value)}
                placeholder={`Enter ${name.replace(/_/g, " ")}`}
                className="min-h-[80px]"
              />
            ) : (
              <Input
                id={name}
                value={editingData[name] || ""}
                onChange={(e) => handleTextChange(name, e.target.value)}
                placeholder={`Enter ${name.replace(/_/g, " ")}`}
              />
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderImageVariables = () => {
    const imageVars = Object.entries(variables).filter(
      ([, v]) => v.type === "image",
    );

    if (imageVars.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          No image variables found in this template
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {imageVars.map(([name, variable]) => (
          <Card key={name}>
            <CardHeader>
              <CardTitle className="text-sm">
                {name.replace(/_/g, " ").toUpperCase()}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {editingData[name] && (
                <div className="relative">
                  <img
                    src={editingData[name]}
                    alt={name}
                    className="w-full h-40 object-cover rounded-lg"
                  />
                  <Button
                    size="icon"
                    variant="destructive"
                    className="absolute top-2 right-2"
                    onClick={() => handleRemoveImage(name)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor={`${name}-upload`}>Upload Image</Label>
                <Input
                  id={`${name}-upload`}
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleImageUpload(name, file);
                    }
                  }}
                  disabled={uploadingImage === name}
                />
                {uploadingImage === name && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Uploading...
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor={`${name}-url`}>Or paste Image URL</Label>
                <Input
                  id={`${name}-url`}
                  value={editingData[name] || ""}
                  onChange={(e) => handleImageUrlChange(name, e.target.value)}
                  placeholder="https://example.com/image.jpg"
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  const renderAvatarVariables = () => {
    const avatarVars = Object.entries(variables).filter(
      ([, v]) => v.type === "avatar",
    );

    // Always show avatar selection even if not in template variables
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Avatar Selection</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Current Avatar ID</Label>
              <Input
                value={avatarId || ""}
                onChange={(e) => onAvatarChange?.(e.target.value)}
                placeholder="Enter HeyGen avatar ID"
              />
              <p className="text-xs text-muted-foreground">
                This avatar will be used in the video. Get avatar IDs from Step
                2 or HeyGen dashboard.
              </p>
            </div>

            {avatarVars.length > 0 && (
              <div className="pt-4 border-t">
                <h4 className="text-sm font-medium mb-2">
                  Template Avatar Variables
                </h4>
                {avatarVars.map(([name]) => (
                  <div key={name} className="space-y-2">
                    <Label>{name.replace(/_/g, " ").toUpperCase()}</Label>
                    <Input
                      value={editingData[name] || ""}
                      onChange={(e) => handleTextChange(name, e.target.value)}
                      placeholder="Enter avatar ID for this variable"
                    />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-accent-blue" />
            <span>Loading template editor...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Template Editor</CardTitle>
        <p className="text-sm text-muted-foreground">
          Customize template variables before generating video
        </p>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="text">
              <Type className="h-4 w-4 mr-2" />
              Text
            </TabsTrigger>
            <TabsTrigger value="images">
              <ImageIcon className="h-4 w-4 mr-2" />
              Images
            </TabsTrigger>
            <TabsTrigger value="avatar">
              <User className="h-4 w-4 mr-2" />
              Avatar
            </TabsTrigger>
          </TabsList>

          <TabsContent value="text" className="space-y-4 mt-4">
            <div className="max-h-[500px] overflow-y-auto pr-2">
              {renderTextVariables()}
            </div>
          </TabsContent>

          <TabsContent value="images" className="space-y-4 mt-4">
            <div className="max-h-[500px] overflow-y-auto pr-2">
              {renderImageVariables()}
            </div>
          </TabsContent>

          <TabsContent value="avatar" className="space-y-4 mt-4">
            <div className="max-h-[500px] overflow-y-auto pr-2">
              {renderAvatarVariables()}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
