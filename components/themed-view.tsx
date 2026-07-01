import { View, type ViewProps } from "react-native";
import { useColors } from "@/hooks/use-colors";

export interface ThemedViewProps extends ViewProps {
  className?: string;
}

/**
 * A View component with automatic theme-aware background.
 * Uses NativeWind for styling - pass className for additional styles.
 */
export function ThemedView({ className, ...otherProps }: ThemedViewProps) {
  const colors = useColors();
  return <View style={{ backgroundColor: colors.background }} {...otherProps} />;
}
