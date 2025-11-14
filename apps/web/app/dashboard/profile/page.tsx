import { ComingSoonSection } from "@/components/dashboard/coming-soon";

const profileHighlights = [
  "Adaptive security postures",
  "Team-based approvals",
  "Personalized recovery workflows",
];

export default function ProfilePage() {
  return (
    <ComingSoonSection
      title="Profile & controls"
      description="Manage guardianship, biometrics, and organization-level access from one secure console."
      highlights={profileHighlights}
    />
  );
}
