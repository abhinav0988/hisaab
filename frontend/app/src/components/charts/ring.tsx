import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { colors } from "../../theme/tokens";

export function ProgressRing({
  size,
  strokeWidth,
  progress,
  color,
  trackColor = "#12352C",
  children,
}: {
  size: number;
  strokeWidth: number;
  progress: number;
  color: string;
  trackColor?: string;
  children?: ReactNode;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const cx = size / 2;
  const clamped = Math.min(Math.max(progress, 0), 1);

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={cx} cy={cx} r={radius} stroke={trackColor} strokeWidth={strokeWidth} fill="none" />
        <Circle
          cx={cx}
          cy={cx}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${Math.max(clamped, 0.02) * circumference} ${circumference}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cx})`}
        />
      </Svg>
      {children}
    </View>
  );
}

export function SegmentedRing({
  size,
  strokeWidth,
  segments,
  children,
}: {
  size: number;
  strokeWidth: number;
  segments: { value: number; color: string }[];
  children?: ReactNode;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const cx = size / 2;
  const total = segments.reduce((sum, segment) => sum + segment.value, 0) || 1;
  const gap = 7;
  let used = 0;

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        {segments.map((segment, index) => {
          const length = Math.max((segment.value / total) * circumference - gap, 4);
          const rotation = -90 + (used / total) * 360;
          used += segment.value;
          return (
            <Circle
              key={`${segment.color}-${index}`}
              cx={cx}
              cy={cx}
              r={radius}
              stroke={segment.color}
              strokeWidth={strokeWidth}
              fill="none"
              strokeDasharray={`${length} ${circumference}`}
              strokeLinecap="butt"
              transform={`rotate(${rotation} ${cx} ${cx})`}
            />
          );
        })}
      </Svg>
      {children}
    </View>
  );
}
