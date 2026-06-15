import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/fixtures")({
  component: FixturesLayout,
});

function FixturesLayout() {
  return <Outlet />;
}
