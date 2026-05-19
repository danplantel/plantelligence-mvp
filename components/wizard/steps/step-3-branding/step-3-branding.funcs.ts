export interface BrandingState {
    organizationName: string;
    logo: string;
    logoFileName: string;
    website: string;
    backgroundImage: string;
    backgroundFileName: string;
    aiAvatar: string;
    avatarFileName: string;
    missionStatement: string;
    brandColor: string;
    primaryColor?: string;
    secondaryColor?: string;
    subdomain: string;
    isPrimaryColorPickerOpen: boolean;
    isSecondaryColorPickerOpen: boolean;
    isAvatarGeneratorOpen: boolean;
    isGenerating: boolean;
    useDefaultWelcomeStatement: boolean;
  }

export interface BrandingActions {
  onDataChange: (field: keyof BrandingState, value: any) => void;
  onFileUpload: (field: 'logo' | 'backgroundImage' | 'avatar', file: File) => void;
  onFileRemove: (field: 'logo' | 'backgroundImage' | 'avatar') => void;
  onAvatarGenerate: (avatarData: any) => void;
  onAvatarGeneratorCancel: () => void;
  onSaveData: () => void;
}

export const createFileHandlers = (setters: any, result: string, file: File) => ({
  logo: () => {
    setters.setLogo(result);
    setters.setLogoFileName(file.name);
  },
  backgroundImage: () => {
    setters.setBackgroundImage(result);
    setters.setBackgroundFileName(file.name);
  },
  avatar: () => {
    setters.setAiAvatar(result);
    setters.setAvatarFileName(file.name);
  },
});

export const createRemoveHandlers = (setters: any) => ({
  logo: () => {
    setters.setLogo("");
    setters.setLogoFileName("");
  },
  background: () => {
    setters.setBackgroundImage("");
    setters.setBackgroundFileName("");
  },
  avatar: () => {
    setters.setAiAvatar("");
    setters.setAvatarFileName("");
  },
});

export const createDataSetters = (setters: any) => ({
    organizationName: setters.setOrganizationName,
    logo: setters.setLogo,
    logoFileName: setters.setLogoFileName,
    website: setters.setWebsite,
    backgroundImage: setters.setBackgroundImage,
    backgroundFileName: setters.setBackgroundFileName,
    missionStatement: setters.setMissionStatement,
    brandColor: setters.setBrandColor,
    primaryColor: setters.setPrimaryColor,
    secondaryColor: setters.setSecondaryColor,
    subdomain: setters.setSubdomain,
    aiAvatar: setters.setAiAvatar,
    avatarFileName: setters.setAvatarFileName,
    isPrimaryColorPickerOpen: setters.setIsPrimaryColorPickerOpen,
    isSecondaryColorPickerOpen: setters.setIsSecondaryColorPickerOpen,
    isAvatarGeneratorOpen: setters.setIsAvatarGeneratorOpen,
    isGenerating: setters.setIsGenerating,
    useDefaultWelcomeStatement: setters.setUseDefaultWelcomeStatement,
  });
