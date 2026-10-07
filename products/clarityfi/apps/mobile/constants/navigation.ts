import { Platform } from "react-native";

export const BOTTOM_NAV_BASE_HEIGHT = Platform.OS === "web" ? 72 : 60;

export function getBottomNavMetrics(bottomInset: number) {
  const safeArea = Platform.OS === "web" ? 0 : bottomInset;

  return {
    height: BOTTOM_NAV_BASE_HEIGHT + safeArea,
    paddingBottom: Platform.OS === "web" ? 12 : Math.max(safeArea, 6),
  };
}
