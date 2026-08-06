/**
 * مكونات الرسوم البيانية البسيطة (بدون مكتبات خارجية)
 * تدعم: أعمدة، خطوط، دائري
 */
import React from "react";
import { View, Text, StyleSheet } from "react-native";

interface BarChartData {
  label: string;
  value: number;
  color?: string;
}

interface BarChartProps {
  data: BarChartData[];
  title?: string;
  height?: number;
  barColor?: string;
}

export function BarChart({ data, title, height = 160, barColor = "#3b82f6" }: BarChartProps) {
  const maxValue = Math.max(...data.map((d) => d.value), 1);

  return (
    <View style={styles.chartContainer}>
      {title && <Text style={styles.chartTitle}>{title}</Text>}
      <View style={[styles.barChartArea, { height }]}>
        {data.map((item, index) => {
          const barHeight = (item.value / maxValue) * (height - 30);
          return (
            <View key={index} style={styles.barColumn}>
              <Text style={styles.barValue}>{item.value}</Text>
              <View
                style={[
                  styles.bar,
                  {
                    height: Math.max(barHeight, 4),
                    backgroundColor: item.color || barColor,
                  },
                ]}
              />
              <Text style={styles.barLabel} numberOfLines={1}>
                {item.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

interface PieChartData {
  label: string;
  value: number;
  color: string;
}

interface PieChartProps {
  data: PieChartData[];
  title?: string;
  size?: number;
}

export function PieChart({ data, title, size = 120 }: PieChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <View style={styles.chartContainer}>
      {title && <Text style={styles.chartTitle}>{title}</Text>}
      <View style={styles.pieContainer}>
        {/* Simplified pie as stacked horizontal bars */}
        <View style={[styles.pieVisual, { width: size, height: size, borderRadius: size / 2 }]}>
          {data.map((item, index) => {
            const percentage = total > 0 ? (item.value / total) * 100 : 0;
            return (
              <View
                key={index}
                style={[
                  styles.pieSegment,
                  {
                    backgroundColor: item.color,
                    width: `${percentage}%`,
                  },
                ]}
              />
            );
          })}
        </View>
        <View style={styles.pieLegend}>
          {data.map((item, index) => {
            const percentage = total > 0 ? ((item.value / total) * 100).toFixed(1) : "0";
            return (
              <View key={index} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                <Text style={styles.legendText}>
                  {item.label} ({percentage}%)
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

interface ProgressBarProps {
  value: number;
  max: number;
  label: string;
  color?: string;
  showPercentage?: boolean;
}

export function ProgressBar({ value, max, label, color = "#3b82f6", showPercentage = true }: ProgressBarProps) {
  const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;

  return (
    <View style={styles.progressContainer}>
      <View style={styles.progressHeader}>
        <Text style={styles.progressLabel}>{label}</Text>
        {showPercentage && (
          <Text style={styles.progressValue}>{percentage.toFixed(0)}%</Text>
        )}
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${percentage}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: string;
  color?: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
}

export function StatCard({ title, value, subtitle, color = "#3b82f6", trend, trendValue }: StatCardProps) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIndicator, { backgroundColor: color }]} />
      <Text style={styles.statTitle}>{title}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      {subtitle && <Text style={styles.statSubtitle}>{subtitle}</Text>}
      {trend && trendValue && (
        <View style={styles.trendRow}>
          <Text
            style={[
              styles.trendText,
              { color: trend === "up" ? "#10b981" : trend === "down" ? "#ef4444" : "#6b7280" },
            ]}
          >
            {trend === "up" ? "▲" : trend === "down" ? "▼" : "●"} {trendValue}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  chartContainer: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1f2937",
    marginBottom: 14,
  },
  barChartArea: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-around",
    paddingTop: 10,
  },
  barColumn: {
    alignItems: "center",
    flex: 1,
    gap: 4,
  },
  barValue: {
    fontSize: 10,
    fontWeight: "600",
    color: "#6b7280",
  },
  bar: {
    width: "60%",
    borderRadius: 4,
    minWidth: 16,
    maxWidth: 40,
  },
  barLabel: {
    fontSize: 9,
    color: "#9ca3af",
    textAlign: "center",
    maxWidth: 50,
  },
  pieContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  pieVisual: {
    flexDirection: "row",
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#f3f4f6",
  },
  pieSegment: {
    height: "100%",
  },
  pieLegend: {
    flex: 1,
    gap: 8,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 11,
    color: "#4b5563",
  },
  progressContainer: {
    marginBottom: 12,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  progressLabel: {
    fontSize: 12,
    color: "#4b5563",
    fontWeight: "500",
  },
  progressValue: {
    fontSize: 12,
    color: "#1f2937",
    fontWeight: "700",
  },
  progressTrack: {
    height: 8,
    backgroundColor: "#f3f4f6",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
  },
  statCard: {
    backgroundColor: "white",
    borderRadius: 14,
    padding: 14,
    flex: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  statIndicator: {
    width: 32,
    height: 4,
    borderRadius: 2,
    marginBottom: 10,
  },
  statTitle: {
    fontSize: 11,
    color: "#6b7280",
    marginBottom: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "bold",
  },
  statSubtitle: {
    fontSize: 10,
    color: "#9ca3af",
    marginTop: 2,
  },
  trendRow: {
    marginTop: 6,
  },
  trendText: {
    fontSize: 10,
    fontWeight: "600",
  },
});
