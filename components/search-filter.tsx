import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useColors } from "@/hooks/use-colors";

export interface FilterOption {
  label: string;
  value: string;
  color?: string;
}

interface SearchFilterProps {
  searchPlaceholder?: string;
  onSearchChange: (text: string) => void;
  searchValue: string;
  filters?: {
    label: string;
    options: FilterOption[];
    value: string | null;
    onChange: (value: string | null) => void;
  }[];
  isRtl?: boolean;
}

export function SearchFilter({
  searchPlaceholder = "Search...",
  onSearchChange,
  searchValue,
  filters = [],
  isRtl = false,
}: SearchFilterProps) {
  const colors = useColors();
  const [expandedFilter, setExpandedFilter] = useState<number | null>(null);

  return (
    <View style={{ backgroundColor: colors.surface }}>
      {/* Search Bar */}
      <View
        style={[
          styles.searchBar,
          {
            backgroundColor: colors.background,
            borderColor: colors.border,
            flexDirection: isRtl ? "row-reverse" : "row",
          },
        ]}
      >
        <MaterialIcons name="search" size={20} color={colors.muted} />
        <TextInput
          placeholder={searchPlaceholder}
          placeholderTextColor={colors.muted}
          value={searchValue}
          onChangeText={onSearchChange}
          style={[styles.searchInput, { color: colors.foreground }]}
        />
        {searchValue ? (
          <Pressable onPress={() => onSearchChange("")}>
            <MaterialIcons name="close" size={20} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>

      {/* Filters */}
      {filters.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ paddingHorizontal: 12, paddingVertical: 8 }}
          contentContainerStyle={{ gap: 8 }}
        >
          {filters.map((filter, index) => (
            <View key={index}>
              <Pressable
                onPress={() =>
                  setExpandedFilter(expandedFilter === index ? null : index)
                }
                style={[
                  styles.filterButton,
                  {
                    backgroundColor:
                      expandedFilter === index ? colors.primary : colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text
                  style={{
                    color: expandedFilter === index ? "white" : colors.foreground,
                    fontSize: 12,
                    fontWeight: "600",
                  }}
                >
                  {filter.label}
                </Text>
                <MaterialIcons
                  name={expandedFilter === index ? "expand-less" : "expand-more"}
                  size={16}
                  color={expandedFilter === index ? "white" : colors.muted}
                  style={{ marginLeft: 4 }}
                />
              </Pressable>

              {/* Filter Options Dropdown */}
              {expandedFilter === index && (
                <View
                  style={[
                    styles.filterDropdown,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  {/* "All" option */}
                  <Pressable
                    onPress={() => {
                      filter.onChange(null);
                      setExpandedFilter(null);
                    }}
                    style={[
                      styles.filterOption,
                      {
                        backgroundColor:
                          !filter.value ? colors.primary : colors.background,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: !filter.value ? "white" : colors.foreground,
                        fontSize: 12,
                      }}
                    >
                      All
                    </Text>
                  </Pressable>

                  {/* Filter options */}
                  {filter.options.map((option) => (
                    <Pressable
                      key={option.value}
                      onPress={() => {
                        filter.onChange(
                          filter.value === option.value ? null : option.value
                        );
                        setExpandedFilter(null);
                      }}
                      style={[
                        styles.filterOption,
                        {
                          backgroundColor:
                            filter.value === option.value
                              ? option.color || colors.primary
                              : colors.background,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color:
                            filter.value === option.value ? "white" : colors.foreground,
                          fontSize: 12,
                        }}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    gap: 8,
    margin: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 4,
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  filterDropdown: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    borderRadius: 6,
    borderWidth: 1,
    zIndex: 1000,
    marginTop: 4,
    overflow: "hidden",
  },
  filterOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "transparent",
  },
});
