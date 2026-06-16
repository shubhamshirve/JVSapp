import { PageHeader } from "@/components/Shared";
import { ProfileCard, ChangePasswordCard } from "@/components/AccountForms";

export default function RestaurantSettings() {
  return (
    <div className="max-w-2xl space-y-6" data-testid="restaurant-settings">
      <PageHeader
        title="Settings"
        subtitle="Update your restaurant profile and password."
      />
      <ProfileCard />
      <ChangePasswordCard />
    </div>
  );
}
