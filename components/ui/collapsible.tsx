import { PropsWithChildren, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";

export function Collapsible({ children, title }: PropsWithChildren & { title: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const colors = useColors();

  return (
    <View style={{ backgroundColor: colors.background }}>
      <TouchableOpacity
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
        onPress={() => setIsOpen((value) => !value)}
        activeOpacity={0.8}
      >
        <IconSymbol
          name="chevron.right"
          size={18}
          weight="medium"
          color={colors.icon}
          style={{ transform: [{ rotate: isOpen ? "90deg" : "0deg" }] }}
        />
        <Text style={{ fontSize: 16, fontWeight: '600', color: colors.foreground }}>{title}</Text>
      </TouchableOpacity>
      {isOpen && <View style={{ marginTop: 6, marginLeft: 24 }}>{children}</View>}
    </View>
  );
}
