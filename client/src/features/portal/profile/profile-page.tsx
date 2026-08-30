import { ProfilePageContent } from "@/features/profile/profile-page-content";
import { PortalPage } from "../portal-ui";
import { usePortalProfile, useUpdatePortalProfile } from "./profile.queries";

export function PortalProfilePage() {
  const query = usePortalProfile();
  const updateMutation = useUpdatePortalProfile();

  return (
    <PortalPage>
      <ProfilePageContent
        profile={query.data}
        isLoading={query.isLoading}
        isError={query.isError}
        onRetry={() => query.refetch()}
        updateMutation={updateMutation}
      />
    </PortalPage>
  );
}
