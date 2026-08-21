import type { Metadata } from "next";
import { TrainingClient } from "@/components/training/TrainingClient";

export const metadata: Metadata = {
  title: "Training",
  description:
    "Train a tabular Q-learning agent on Q-Runner levels in your browser and watch what it learned.",
  alternates: { canonical: "/training" },
};

export default function TrainingPage() {
  return <TrainingClient />;
}
