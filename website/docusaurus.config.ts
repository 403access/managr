import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";
import { themes as prismThemes } from "prism-react-renderer";

const config: Config = {
  title: "managr",
  tagline: "A local desk for one German UG (haftungsbeschränkt)",
  url: "https://403access.github.io",
  baseUrl: "/managr/",
  organizationName: "403access",
  projectName: "managr",
  trailingSlash: false,
  onBrokenLinks: "throw",
  onBrokenAnchors: "throw",
  markdown: {
    format: "detect",
    hooks: {
      onBrokenMarkdownLinks: "throw",
    },
  },
  favicon: "img/favicon.svg",
  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },
  plugins: [
    [
      "@docusaurus/plugin-client-redirects",
      {
        redirects: [
          { from: "/architecture", to: "/docs/architecture" },
          { from: "/domain", to: "/docs/domain" },
          { from: "/roadmap", to: "/docs/roadmap" },
        ],
      },
    ],
  ],
  presets: [
    [
      "classic",
      {
        docs: {
          path: "../docs",
          routeBasePath: "docs",
          sidebarPath: "./sidebars.ts",
          editUrl: ({ docPath }) =>
            `https://github.com/403access/managr/edit/main/docs/${docPath}`,
        },
        blog: false,
        theme: {
          customCss: "./src/css/custom.css",
        },
      } satisfies Preset.Options,
    ],
  ],
  themeConfig: {
    navbar: {
      title: "managr",
      items: [
        { to: "/", label: "Home", position: "left", activeBaseRegex: "^/managr/?$" },
        {
          type: "docSidebar",
          sidebarId: "docs",
          position: "left",
          label: "Docs",
        },
        {
          href: "https://github.com/403access/managr",
          label: "GitHub",
          position: "right",
        },
      ],
    },
    footer: {
      style: "dark",
      links: [
        {
          title: "Site",
          items: [
            { label: "Home", to: "/" },
            { label: "GitHub", href: "https://github.com/403access/managr" },
          ],
        },
        {
          title: "Docs",
          items: [
            { label: "Overview", to: "/docs" },
            { label: "Architecture", to: "/docs/architecture" },
            { label: "Domain rules", to: "/docs/domain" },
            { label: "Roadmap", to: "/docs/roadmap" },
          ],
        },
      ],
      copyright:
        "A planning aid. It does not file a return, calculate wage tax, or decide social-insurance status.",
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
