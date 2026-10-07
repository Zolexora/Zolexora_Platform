import React from "react";
import { Text, TextStyle } from "react-native";

interface Props {
  amount: number;
  style?: TextStyle | TextStyle[];
  signed?: boolean;
  type?: "income" | "expense";
}

function formatNumber(amount: number) {
  return Math.abs(amount)
    .toFixed(2)
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export default function Currency({ amount, style, signed, type }: Props) {
  const sign = signed ? (type === "income" ? "+" : "-") : "";
  return (
    <Text style={style}>
      {sign}
      {/* Use system font for ₹ so it always renders correctly on all devices */}
      <Text style={{ fontFamily: undefined }}>₹</Text>
      {formatNumber(amount)}
    </Text>
  );
}
