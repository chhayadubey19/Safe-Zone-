import type { Metadata } from "next";
import { AboutContent } from "./about-content";

export const metadata: Metadata = {
  title: "About — SafeZone",
  description:
    "What SafeZone is, who it is for and how it works: Bhopal's community safety registry — venue passports, citizen reports, municipal inspections and AI photo analysis, transparent by default.",
};

export default function AboutPage() {
  return <AboutContent />;
}
