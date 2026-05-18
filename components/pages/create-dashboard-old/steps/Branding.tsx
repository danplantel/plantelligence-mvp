"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { PickerColor } from "@/components/ui/picker-color";
import { Separator } from "@/components/ui/separator";
import type { InfoTypes } from "@/types/InfoTypes";
import { zodResolver } from "@hookform/resolvers/zod";
import { FileTextIcon, InfoCircledIcon } from "@radix-ui/react-icons";
import { useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { boolean, object, string } from "zod";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { motion } from "framer-motion";

type BrandingInfoTypes = {
  clientName?: string;
  videoThemeColor?: string;
  videoAvatar?: string;
  videoBackgroundMusic?: string;
  videoBackgroundImage?: File | string | null;
  buildSpanishVideo?: boolean;
  clientLogo?: File | string | null;
  [key: string]: any;
};

interface IBranding {
  setActiveTab: (tab: string) => void;
  info: Partial<InfoTypes>;
  updateInfo: (info: Partial<InfoTypes>) => void;
}

const brandingSchema = object({
  clientName: string().min(1, { message: "Client name is required" }),
  videoThemeColor: string().optional(),
  videoAvatar: string().optional(),
  videoBackgroundMusic: string().optional(),
  videoBackgroundImage: object({}).nullable().optional(),
  buildSpanishVideo: boolean().optional(),
  clientLogo: object({}).nullable().optional(),
});

const Branding = ({ setActiveTab, updateInfo, info }: IBranding) => {
  const fileClientLogoRef = useRef<HTMLInputElement | null>(null);
  const fileVideoBackgroundImageRef = useRef<HTMLInputElement | null>(null);
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [displayedScript, setDisplayedScript] = useState("");

  const [customAvatar, setCustomAvatar] = useState(false);
  const [contactInfo, setContactInfo] = useState({ name: "", email: "" });

  const form = useForm<BrandingInfoTypes>({
    resolver: zodResolver(brandingSchema),
    defaultValues: {
      clientName: info?.clientName || "",
      clientLogo: info?.clientLogo || null,
      videoThemeColor: info?.videoThemeColor || "",
      videoAvatar: info?.videoAvatar || "",
      videoBackgroundMusic: info?.videoBackgroundMusic || "",
      videoBackgroundImage: info?.videoBackgroundImage || null,
      buildSpanishVideo: info?.buildSpanishVideo || false,
    },
    mode: "onChange",
  });

  const {
    control,
    setValue,
    watch,
    formState: { errors },
  } = form;

  // Watch fields for client logo and background image
  const [clientLogo, videoBackgroundImage] = watch([
    "clientLogo",
    "videoBackgroundImage",
  ]);

  const previewClientLogoUrl = useMemo(() => {
    if (clientLogo instanceof File) {
      return URL.createObjectURL(clientLogo);
    }
    return clientLogo;
  }, [clientLogo]);

  const previewVideoBackgroundImageUrl = useMemo(() => {
    if (videoBackgroundImage instanceof File) {
      return URL.createObjectURL(videoBackgroundImage);
    }
    return videoBackgroundImage;
  }, [videoBackgroundImage]);

  const handleSubmit = (data: Partial<InfoTypes>) => {
    setActiveTab("planDetails");
    updateInfo({
      ...data,
      clientLogo: clientLogo,
      videoBackgroundImage: videoBackgroundImage,
      videoAvatar: data.videoAvatar,
    });
  };

  const scriptText = [
    "Hello, I'm ",
    "{avatar.name}. ",
    "I'm here to be your trusted partner ",
    "in empowering your clients ",
    "with greater financial literacy. ",
    "Together, we can make complex ",
    "topics simple and engaging.",
  ];

  // useEffect(() => {
  //   setValue("clientName", info?.clientName || "");
  //   setValue("clientLogo", info?.clientLogo || null);
  //   setValue("videoThemeColor", info?.videoThemeColor || "");
  //   setValue("videoAvatar", info?.videoAvatar || "");
  //   setValue("buildSpanishVideo", info?.buildSpanishVideo || false);
  //   setValue("videoBackgroundMusic", info?.videoBackgroundMusic || "");
  //   setValue("videoBackgroundImage", info?.videoBackgroundImage || null);
  // }, [info, setValue]);

  const avatars = [
    {
      src: "/avatars/paul.png",
      video: "/avatars/paul.mp4",
      personality: "Friendly, Knowledgeable, Trustworthy",
      description:
        "Paul is your go-to expert for simplifying complex financial concepts.",
      traits: ["Trustworthy", "Knowledgeable", "Business Professional Attire"],
      alt: "Paul",
      id: "fb7d1582-9a8a-4c0a-8a0b-fa18497d23f1", // real name Chun but there are many options so need to figure out which is correct style
    },
    {
      src: "/avatars/alicia.png",
      video: "/avatars/alicia.mp4",
      personality: "Friendly, Knowledgeable, Trustworthy",
      description:
        "Alicia is your go-to expert for simplifying complex financial concepts.",
      traits: ["Reliable", "Approachable", "Business Professional Attire"],
      alt: "Alicia",
      id: "1bb94682-21bc-490b-b9d5-4aa21a6e130c", // not sure if this is the correct one, there are many named Alex at docs.synthesia.io/reference/avatars
    },
    {
      src: "/avatars/daryl.png",
      video: "/avatars/daryl.mp4",
      personality: "Friendly, Knowledgeable, Trustworthy",
      description:
        "Daryl is your go-to expert for simplifying complex financial concepts.",
      traits: ["Friendly", "Relatable", "Business Casual Attire"],
      alt: "Daryl",
      id: "46ccbb49-5547-4aec-803b-0b542ccd17e8",
    },
    {
      src: "/avatars/allison.png",
      video: "/avatars/allison.mp4",
      personality: "Friendly, Knowledgeable, Trustworthy",
      description:
        "Allison is your go-to expert for simplifying complex financial concepts.",
      traits: ["Knowledgeable", "Energetic", "Business Casual Attire"],
      alt: "Allison",
      id: "440548a8-4701-402f-afdb-6d32a851a3a6",
    },
    {
      src: "/avatars/leah.png",
      video: "/avatars/leah.mp4",
      personality: "Friendly, Knowledgeable, Trustworthy",
      description:
        "Leah is your go-to expert for simplifying complex financial concepts.",
      traits: ["Friendly", "Approachable", "Business Professional Attire"],
      alt: "Leah",
      id: "592c96ac-e1aa-4623-b2a4-919a9aab82da",
    },
    {
      src: "/avatars/chad.png",
      video: "/avatars/chad.mp4",
      personality: "Friendly, Knowledgeable, Trustworthy",
      description:
        "Chad is your go-to expert for simplifying complex financial concepts.",
      traits: ["Trustworthy", "Professional", "Smart Casual Attire"],
      alt: "Chad",
      id: "cd556ea0-c95a-496b-924b-dd138bac91ae", // for jonathan we named Chad
    },
    // {
    //   src: "/avatars/cole.png",
    //   // video: "/avatars/cole.mp4",
    //   alt: "Cole",
    //   id: "67200982-810c-4955-b39a-0d1de7d107d2",
    // },
    // {
    //   src: "/avatars/thomas.png",
    //   // video: "/avatars/thomas.mp4",
    //   alt: "Thomas",
    //   id: "d1a0c8e1-bbc4-4c60-8c31-a1223e8adbd7",
    // },
    // {
    //   src: "/avatars/arthur.png",
    //   // video: "/avatars/arthur.mp4",
    //   alt: "Arthur",
    //   id: "86dabc70-a825-465e-9b24-d4317beb73b1",
    // },
    // {
    //   src: "/avatars/helena.png",
    //   // video: "/avatars/helena.mp4",
    //   alt: "Helena",
    //   id: "2046205b-19d0-499f-bb4a-6631bfd30c4d",
    // },
    // {
    //   src: "/avatars/mariana.png",
    //   // video: "/avatars/mariana.mp4",
    //   alt: "Mariana",
    //   id: "e5e8c04f-da63-4365-bf21-2eb313258309",
    // },
    // { src: "/avatars/jackie.png", alt: "Jackie", id: "099a3571-ad3a-4301-b18b-0280416518f1" },
    // { src: "/avatars/Ophelia.png", alt: "Ophelia", id: "053a5918-9a5d-453a-8cac-929528258b92" },
  ];

  const selectedAvatarDetails = avatars.find(
    (avatar) => avatar.video === selectedAvatar,
  );

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="w-full">
        <div className="mb-4">
          <FormField
            control={control}
            name="clientName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Client Name</FormLabel>
                <FormControl>
                  <Input placeholder="Enter client name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="clientLogo"
          render={({ field }) => (
            <FormItem>
              <div>
                <FormLabel>Client Logo</FormLabel>
                <FormControl>
                  <Button
                    className="flex cursor-pointer items-center gap-[4px] justify-center rounded-[9999px] mt-[10px] w-fit"
                    type="button"
                    onClick={() => fileClientLogoRef?.current?.click()}
                  >
                    <FileTextIcon />
                    <span>Upload logo</span>
                    <Input
                      type="file"
                      className="hidden"
                      ref={fileClientLogoRef}
                      onChange={(e) => {
                        const file = e?.target?.files?.[0];
                        if (file) {
                          setValue("clientLogo", file);
                          field.onChange(file);
                        }
                      }}
                    />
                  </Button>
                </FormControl>
                <img
                  src={previewClientLogoUrl || "/placeholder.svg"}
                  alt=""
                  className="block max-h-[100px] py-[8px]"
                />
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="mb-4">
          <InfoCircledIcon className="inline-flex text-gray-500 dark:text-white" />{" "}
          <span className="text-[12px] text-[#959595]">
            For best results, upload your logo in landscape format.
          </span>
        </div>

        <div className="mb-4">
          <FormField
            control={control}
            name="videoThemeColor"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Video Theme Color</FormLabel>
                <FormControl>
                  <div className="mt-2">
                    <PickerColor
                      color={field.value || "#EAEAEA"}
                      onChange={(color) => setValue("videoThemeColor", color)}
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={control}
          name="videoAvatar"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Video Avatar Selection</FormLabel>
              <FormControl>
                <div className="grid grid-cols-2 gap-4 mt-2 sm:grid-cols-3">
                  {avatars.map((avatar) => (
                    <div
                      key={avatar.id}
                      className={`relative px-4 pt-[14px] pb-1 rounded-lg cursor-pointer shadow-lg transition-all duration-200 ease-in-out ${
                        field.value === avatar.id
                          ? "border-2 border-primary"
                          : "border border-[#efefef] dark:border-[#1c1c1c]"
                      } group`}
                      onClick={() => {
                        field.onChange(avatar.id);
                        setSelectedAvatar(avatar.video ?? null);
                      }}
                    >
                      <img
                        src={avatar.src || "/placeholder.svg"}
                        alt={avatar.alt}
                        className="w-full transition-all duration-200 ease-in-out rounded-md group-hover:blur-sm"
                      />
                      <div className="absolute inset-0 flex items-center justify-center transition-opacity duration-300 opacity-0 group-hover:opacity-100">
                        <Button
                          className="text-black bg-white rounded-full shadow-md hover:text-black"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedAvatar(avatar.video ?? null);
                            setIsModalOpen(true);
                          }}
                        >
                          Preview
                        </Button>
                      </div>
                      <div className="mt-2 font-medium text-center text-md">
                        {avatar.alt}
                      </div>
                    </div>
                  ))}
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">Don&apos;t see what you&apos;re looking for?</p>
          <Button
            type="button"
            className="px-6 py-2 mt-2 rounded-full bg-primary"
            onClick={() => setCustomAvatar(true)}
          >
            Create Personalized Avatar
          </Button>
        </div> */}

        {customAvatar && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="max-w-md p-6 mx-auto mt-6 text-center bg-transparent border rounded-lg dark:bg-gray-800 dark:border-gray-600"
          >
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
              Thanks! We&apos;ll be in touch.
            </h3>
            <p className="max-w-[320px] mx-auto mt-2 text-sm text-gray-500 dark:text-gray-400">
              Our team will reach out to you shortly to discuss your
              personalized avatar request.
            </p>
          </motion.div>
        )}

        {/* <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogOverlay />
          <DialogContent className="max-w-xl p-6 mx-auto">
            {selectedAvatar && (
              <video
                src={selectedAvatar}
                controls
                autoPlay
                className="w-full mt-4 rounded-lg shadow-lg border border-[#efefef] dark:border-[#1c1c1c]"
              />
            )}
          </DialogContent>
        </Dialog> */}

        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="p-6 mx-auto bg-white dark:bg-[#1c1c1c] rounded-lg shadow-xl">
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              {selectedAvatarDetails ? (
                <div className="flex flex-col items-center">
                  <div className="w-full mt-4">
                    <video
                      src={selectedAvatarDetails.video}
                      controls
                      autoPlay
                      className="w-full rounded-lg shadow-lg border border-[#efefef] dark:border-[#1c1c1c]"
                    />
                  </div>

                  {selectedAvatarDetails.traits &&
                  selectedAvatarDetails.traits.length > 0 ? (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{
                        duration: 0.2,
                        ease: "easeOut",
                        delay: 0.2,
                      }}
                      className="flex flex-col items-center mt-6"
                    >
                      <h3 className="font-semibold text-gray-700 text-md dark:text-gray-300">
                        Related Traits
                      </h3>
                      <ul className="flex gap-2 mt-2">
                        {selectedAvatarDetails.traits.map((trait, index) => (
                          <motion.li
                            key={index}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2, delay: index * 0.1 }}
                            className="px-3 py-1 text-sm font-medium text-white rounded-full dark:text-black bg-primary"
                          >
                            {trait}
                          </motion.li>
                        ))}
                      </ul>
                    </motion.div>
                  ) : (
                    <p className="mt-4 text-center text-gray-500">
                      No traits available
                    </p>
                  )}
                </div>
              ) : (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center text-gray-500"
                >
                  No avatar selected
                </motion.p>
              )}
            </motion.div>
          </DialogContent>
        </Dialog>

        <div className="mt-4 mb-4">
          <FormField
            control={control}
            name="videoBackgroundMusic"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Video Background Music</FormLabel>
                <FormControl>
                  <Input
                    disabled
                    placeholder="Select background music"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="mb-4">
          <FormField
            control={control}
            name="videoBackgroundImage"
            render={({ field }) => (
              <FormItem>
                <div>
                  <FormLabel>Video Background Image</FormLabel>
                  <FormControl>
                    <Button
                      className="flex cursor-pointer items-center gap-[4px] justify-center rounded-[9999px] mt-[10px] w-fit"
                      type="button"
                      onClick={() =>
                        fileVideoBackgroundImageRef?.current?.click()
                      }
                    >
                      <FileTextIcon />
                      <span>Upload image</span>
                      <Input
                        type="file"
                        className="hidden"
                        accept="image/png,image/jpeg,image/jpg" // Allow only supported image files
                        ref={fileVideoBackgroundImageRef}
                        onChange={(e) => {
                          const file = e?.target?.files?.[0];
                          if (file) {
                            setValue("videoBackgroundImage", file);
                            field.onChange(file);
                          }
                        }}
                      />
                    </Button>
                  </FormControl>
                  <img
                    src={previewVideoBackgroundImageUrl || "/placeholder.svg"}
                    alt=""
                    className="block max-h-[100px] py-[8px]"
                  />
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="mb-4">
          <FormField
            control={control}
            name="buildSpanishVideo"
            render={({ field }) => (
              <FormItem>
                <div className="inline-flex items-center gap-[10px]">
                  <FormControl>
                    <Checkbox
                      onCheckedChange={(checked: boolean) =>
                        setValue("buildSpanishVideo", checked)
                      }
                      checked={watch("buildSpanishVideo")}
                      className="cursor-not-allowed"
                      disabled={true}
                    />
                  </FormControl>
                  <FormLabel>Build Spanish Video</FormLabel>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Separator />
        <div className="flex justify-center">
          <Button type="submit" className="mt-[12px] rounded-full">
            Next: Plan Type
          </Button>
        </div>
      </form>
    </Form>
  );
};

export default Branding;
