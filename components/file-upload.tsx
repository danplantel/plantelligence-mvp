"use client";
import { OurFileRouter } from "@/app/api/uploadthing/core";
import { UploadDropzone } from "@uploadthing/react";
import { Trash } from "lucide-react";
import Image from "next/image";
import { UploadFileResponse } from "uploadthing/client";
import { IMG_MAX_LIMIT } from "@/constants/data";
import { Button } from "./ui/button";
import { useToast } from "./ui/use-toast";

interface ImageUploadProps {
  onChange?: any;
  onRemove: (value: UploadFileResponse[]) => void;
  value: UploadFileResponse[];
}

export default function FileUpload({
  onChange,
  onRemove,
  value,
}: ImageUploadProps) {
  const { toast } = useToast();
  const onDeleteFile = (key: string) => {
    const files = value;
    let filteredFiles = files.filter((item) => item.key !== key);
    onRemove(filteredFiles);
  };

  const onUpdateFile = (newFiles: UploadFileResponse[]) => {
    onChange([...value, ...newFiles]);
  };
  
  return (
    <div>
      <div className="flex items-center gap-4 mb-4 cursor-pointer">
        {!!value.length &&
          value?.map((item) => {
            return (
              <div
                key={item.key}
                className="relative w-full h-[200px] rounded-md overflow-hidden"
              >
                <div className="absolute z-10 top-2 right-2">
                  <Button
                    type="button"
                    onClick={() => onDeleteFile(item.key)}
                    variant="destructive"
                    size="sm"
                  >
                    <Trash className="w-4 h-4" />
                  </Button>
                </div>
                <div>
                  <Image
                    fill
                    className="object-cover"
                    alt="Image"
                    src={item.fileUrl || ""}
                  />
                </div>
              </div>
            )
          })}
      </div>
      <div>
        {value.length < IMG_MAX_LIMIT && (
          <UploadDropzone<OurFileRouter>
            className="py-2 dark:bg-zinc-800 ut-label:text-sm ut-allowed-content:ut-uploading:text-red-300"
            endpoint="imageUploader"
            config={{ mode: "auto" }}
            content={{
              allowedContent({ isUploading }) {
                if (isUploading)
                  return (
                    <>
                      <p className="mt-2 text-sm text-slate-400 animate-pulse">
                        Image Uploading...
                      </p>
                    </>
                  );
              },
            }}
            onClientUploadComplete={(res) => {
              // Do something with the response
              const data: UploadFileResponse[] | undefined = res;
              if (data) {
                onUpdateFile(data);
              }
            }}
            onUploadError={(error: Error) => {
              toast({
                title: "Error",
                variant: "destructive",
                description: error.message,
              });
            }}
            onUploadBegin={() => {
              // Do something once upload begins
            }}
          />
        )}
      </div>
    </div>
  );
}
