import type {
  AboutContent,
  BrandingSettings,
  ContactSettings,
  HomepageContent,
  NavigationSettings,
  VisionContent,
} from './types.ts';

export const DEFAULT_HOMEPAGE: HomepageContent = {
  heroHeading: 'SMARTER EXAMINATIONS. BETTER EDUCATION. DIGITAL EXCELLENCE.',
  heroSubheading:
    'JAIMAN GOLDENLITE TECH LTD provides reliable, efficient, and professional Computer-Based Testing solutions designed to improve examination experiences for Nigerian secondary schools.',
  aboutPreviewTitle: 'Built for Nigerian Secondary Schools',
  aboutPreviewBody:
    'JAIMAN GOLDENLITE TECH LTD is committed to making digital examinations accessible, dependable, and straightforward for secondary schools across Nigeria. We combine clean, distraction-free student testing interfaces with structured administrative tools so principals, examination officers, and teachers can conduct assessments with confidence.',
  services: [
    {
      title: 'Computer-Based Testing (CBT)',
      description:
        'Secure, timed digital examination environments supporting multiple-choice assessments, automatic saving, and clear question navigation.',
      highlight: 'Core Platform',
    },
    {
      title: 'Digital Examination Management',
      description:
        'End-to-end management of examination schedules, subject question banks, class assignments, and automated objective marking.',
      highlight: 'School Workflow',
    },
    {
      title: 'School Examination Support',
      description:
        'Dedicated onboarding, school credential setup, student enrolment guidance, and structured technical support for examination officers.',
      highlight: 'Institutional Care',
    },
    {
      title: 'Online Assessment Solutions',
      description:
        'Accessible web-based testing tools that run smoothly across school computer laboratories, laptops, tablets, and mobile devices.',
      highlight: 'Multi-Device',
    },
    {
      title: 'Educational Technology Services',
      description:
        'Practical digital transformation solutions tailored to improve assessment efficiency, record accuracy, and academic administration.',
      highlight: 'EdTech Advisory',
    },
  ],
  whyChooseUs: [
    'Simple and user-friendly examination interfaces.',
    'Efficient digital examination processes.',
    'Reliable examination management.',
    'Solutions designed for Nigerian secondary schools.',
    'Commitment to educational innovation.',
  ],
  ctaHeading: "Ready to Take Your School's Examinations Digital?",
  ctaText:
    'Partner with JAIMAN GOLDENLITE TECH LTD for a smarter and more organized examination experience.',
};

export const DEFAULT_ABOUT: AboutContent = {
  whoWeAre:
    'JAIMAN GOLDENLITE TECH LTD is an educational technology service provider focused on delivering professional Computer-Based Testing solutions to Nigerian secondary schools. We aim to make digital examinations simpler, more accessible, and more efficient for schools, teachers, and students.',
  whatWeDoIntro:
    'We partner with secondary school proprietors, principals, and examination officers to modernize every stage of school assessment—from question preparation to instant result generation.',
  whatWeDoItems: [
    'Providing CBT solutions to schools.',
    'Supporting digital examination processes.',
    'Improving examination accessibility.',
    'Helping schools embrace modern educational technology.',
  ],
  coreValues: [
    {
      title: 'Excellence',
      description:
        'Maintaining high technical and operational standards across every examination session and school deployment.',
    },
    {
      title: 'Integrity',
      description:
        'Protecting examination credibility through secure student authentication, locked submissions, and accurate marking.',
    },
    {
      title: 'Innovation',
      description:
        'Developing practical digital tools that solve real examination challenges faced by Nigerian secondary schools.',
    },
    {
      title: 'Reliability',
      description:
        'Delivering dependable platforms with automatic answer saving so students never lose progress during testing.',
    },
    {
      title: 'Simplicity',
      description:
        'Designing clear, intuitive interfaces that students and teachers can operate comfortably without steep learning curves.',
    },
    {
      title: 'Customer Satisfaction',
      description:
        'Listening closely to school administrators and educators to ensure every assessment cycle runs smoothly.',
    },
  ],
  commitmentTitle: 'Our Commitment to Nigerian Education',
  commitmentBody:
    'We are dedicated to providing dependable technology solutions that support the future of education in Nigeria. By equipping secondary schools with accessible Computer-Based Testing infrastructure, we help students build digital confidence while giving educators faster, clearer insights into academic performance.',
};

export const DEFAULT_VISION: VisionContent = {
  mainHeading: 'OUR VISION: TRANSFORMING EDUCATION THROUGH DIGITAL INNOVATION.',
  visionStatement:
    'To become a trusted and leading provider of digital examination solutions in Nigeria by empowering secondary schools with accessible, reliable, and innovative Computer-Based Testing technology.',
  missionStatement:
    'To simplify school examinations through user-friendly technology, dependable CBT services, and innovative digital assessment solutions that support effective teaching and learning.',
  goals: [
    'Make digital examinations accessible to more Nigerian secondary schools.',
    'Improve the efficiency of school assessment systems.',
    'Promote technology-driven education.',
    'Support schools in transitioning from traditional examinations to digital assessments.',
    'Deliver reliable and user-friendly CBT experiences.',
    'Continuously improve our educational technology solutions.',
  ],
  futureCommitmentTitle: 'Our Commitment to the Future',
  futureCommitmentBody:
    'JAIMAN GOLDENLITE TECH LTD remains steadfast in advancing quality educational technology across Nigeria. We continually refine our assessment platform to uphold examination integrity, reduce administrative workload for teachers, and prepare secondary school students for a digital academic future.',
};

export const DEFAULT_BRANDING: BrandingSettings = {
  companyName: 'JAIMAN GOLDENLITE TECH LTD',
  brandMessage:
    'JAIMAN GOLDENLITE TECH LTD — EMPOWERING SCHOOLS THROUGH SMARTER DIGITAL EXAMINATIONS.',
  logoText: 'JAIMAN GOLDENLITE TECH LTD',
  logoImageUrl: '',
  deepBlue: '#123B72',
  professionalBlue: '#1769AA',
  pink: '#E83E8C',
  gold: '#D4AF37',
  cyan: '#20C4D8',
  footerDescription:
    'Providing reliable, efficient, and accessible Computer-Based Testing (CBT) solutions and digital examination management for Nigerian secondary schools.',
  copyrightText: `© ${new Date().getFullYear()} JAIMAN GOLDENLITE TECH LTD. All rights reserved.`,
};

export const DEFAULT_CONTACT: ContactSettings = {
  heading: "LET'S CONNECT AND BUILD A SMARTER EXAMINATION EXPERIENCE.",
  supportingText:
    'Have questions about our CBT services? Need digital examination solutions for your school? Get in touch with our team.',
  phonePlaceholder: '+2348066445275',
  emailPlaceholder: 'jaimangoldenlitetechltd@gmail.com',
  officeAddressPlaceholder: 'Igarra, Akoko-Edo L. G. A., Edo State, Nigeria.',
  whatsappPlaceholder: 'https://wa.me/2348066445275',
  facebookUrl: '',
  instagramUrl: '',
  linkedinUrl: '',
  xUrl: '',
};

export const DEFAULT_NAVIGATION: NavigationSettings = {
  showHome: true,
  showAbout: true,
  showCbt: true,
  showContact: true,
  showVision: true,
};
