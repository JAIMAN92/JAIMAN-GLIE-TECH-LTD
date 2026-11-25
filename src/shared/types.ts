export interface HomepageContent {
  heroHeading: string;
  heroSubheading: string;
  aboutPreviewTitle: string;
  aboutPreviewBody: string;
  services: Array<{
    title: string;
    description: string;
    highlight: string;
  }>;
  whyChooseUs: string[];
  ctaHeading: string;
  ctaText: string;
}

export interface AboutContent {
  whoWeAre: string;
  whatWeDoIntro: string;
  whatWeDoItems: string[];
  coreValues: Array<{
    title: string;
    description: string;
  }>;
  commitmentTitle: string;
  commitmentBody: string;
}

export interface VisionContent {
  mainHeading: string;
  visionStatement: string;
  missionStatement: string;
  goals: string[];
  futureCommitmentTitle: string;
  futureCommitmentBody: string;
}

export interface BrandingSettings {
  companyName: string;
  brandMessage: string;
  logoText: string;
  logoImageUrl: string;
  deepBlue: string;
  professionalBlue: string;
  pink: string;
  gold: string;
  cyan: string;
  footerDescription: string;
  copyrightText: string;
}

export interface ContactSettings {
  heading: string;
  supportingText: string;
  phonePlaceholder: string;
  emailPlaceholder: string;
  officeAddressPlaceholder: string;
  whatsappPlaceholder: string;
  facebookUrl: string;
  instagramUrl: string;
  linkedinUrl: string;
  xUrl: string;
}

export interface NavigationSettings {
  showHome: boolean;
  showAbout: boolean;
  showCbt: boolean;
  showContact: boolean;
  showVision: boolean;
}

export interface ClassArmItem {
  id: number;
  classLevel: string;
  armName: string;
  displayName: string;
}

export interface SiteData {
  homepage: HomepageContent;
  about: AboutContent;
  vision: VisionContent;
  branding: BrandingSettings;
  contact: ContactSettings;
  navigation: NavigationSettings;
  announcements: Array<{
    id: number;
    title: string;
    message: string;
    targetPage: string;
    isActive: boolean;
    createdAt: string;
  }>;
  classArms?: ClassArmItem[];
}

export interface SafeAdmin {
  id: number;
  username: string;
  email: string;
  fullName: string;
  mustChangePassword: boolean;
}
