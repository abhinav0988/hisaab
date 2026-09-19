import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../theme/tokens";
import type { IconName } from "../../config/finance-tools";

export function Icon({
  name,
  size = 21,
  color = colors.green,
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  return <Ionicons name={name} size={size} color={color} />;
}
