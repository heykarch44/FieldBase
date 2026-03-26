import React from "react";
import { useOrg } from "../../src/providers/OrgProvider";
import RouteView from "../../src/components/home/RouteView";
import ScheduleView from "../../src/components/home/ScheduleView";

export default function HomeScreen() {
  const { routesEnabled } = useOrg();
  return routesEnabled ? <RouteView /> : <ScheduleView />;
}
