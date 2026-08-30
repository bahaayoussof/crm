import { ProfilePageContent } from "./profile-page-content";
import { useSelfProfile, useUpdateSelfProfile } from "./profile.queries";

export function InternalProfilePage() {
  const query = useSelfProfile();
  const updateMutation = useUpdateSelfProfile();

  return (
    <main className="page-container">
      <ProfilePageContent
        profile={query.data}
        isLoading={query.isLoading}
        isError={query.isError}
        onRetry={() => query.refetch()}
        updateMutation={updateMutation}
      />
    </main>
  );
}
