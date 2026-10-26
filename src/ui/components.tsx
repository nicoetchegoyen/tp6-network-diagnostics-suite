import React, { PropsWithChildren } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
export const C = {
  bg: "#F4F6F3",
  card: "#FFFFFF",
  ink: "#173B3A",
  muted: "#71817D",
  green: "#187B64",
  pale: "#E7F1EA",
  line: "#DFE6DF",
  amber: "#A36A17",
  red: "#AF4943",
  navy: "#102F30",
};
export type IconName = React.ComponentProps<typeof Ionicons>["name"];
export function Icon({
  name,
  size = 22,
  color = C.ink,
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  return <Ionicons name={name} size={size} color={color} />;
}
export function Label({ children }: PropsWithChildren) {
  return <Text style={s.label}>{children}</Text>;
}
export function Card({
  children,
  style,
}: PropsWithChildren<{ style?: object }>) {
  return <View style={[s.card, style]}>{children}</View>;
}
export function Badge({
  children,
  tone = "green",
}: PropsWithChildren<{ tone?: "green" | "amber" | "muted" | "red" }>) {
  const color = { green: C.green, amber: C.amber, muted: C.muted, red: C.red }[
    tone
  ];
  return (
    <View style={[s.badge, { backgroundColor: `${color}12` }]}>
      <View style={[s.dot, { backgroundColor: color }]} />
      <Text style={{ color, fontSize: 11, fontWeight: "700" }}>{children}</Text>
    </View>
  );
}
export function Button({
  title,
  onPress,
  icon,
  secondary,
  busy,
  disabled,
  small,
}: {
  title: string;
  onPress(): void;
  icon?: IconName;
  secondary?: boolean;
  busy?: boolean;
  disabled?: boolean;
  small?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        secondary && s.secondary,
        small && { paddingVertical: 10, paddingHorizontal: 12 },
        (disabled || busy) && { opacity: 0.5 },
        pressed && { opacity: 0.75 },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={secondary ? C.green : "white"} />
      ) : (
        icon && (
          <Icon name={icon} color={secondary ? C.green : "white"} size={18} />
        )
      )}
      <Text style={[s.buttonText, secondary && { color: C.green }]}>
        {title}
      </Text>
    </Pressable>
  );
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: 7 }}>
      <Label>{label}</Label>
      <TextInput
        placeholderTextColor="#8B9891"
        style={[
          s.input,
          props.multiline && { minHeight: 112, textAlignVertical: "top" },
        ]}
        {...props}
      />
    </View>
  );
}
export function Empty({
  icon,
  title,
  text,
}: {
  icon: IconName;
  title: string;
  text: string;
}) {
  return (
    <View style={s.empty}>
      <View style={s.emptyIcon}>
        <Icon name={icon} color={C.green} size={28} />
      </View>
      <Text style={s.emptyTitle}>{title}</Text>
      <Text style={s.emptyText}>{text}</Text>
    </View>
  );
}
export function Section({ title, detail }: { title: string; detail?: string }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      {detail && <Text style={s.caption}>{detail}</Text>}
    </View>
  );
}
export function KV({ label, value }: { label: string; value: unknown }) {
  return (
    <View style={s.kv}>
      <Text style={s.caption}>{label}</Text>
      <Text selectable style={s.kvValue}>
        {String(value ?? "No disponible")}
      </Text>
    </View>
  );
}
export const s = StyleSheet.create({
  card: {
    backgroundColor: C.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.line,
    padding: 20,
    gap: 16,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    color: C.muted,
    textTransform: "uppercase",
  },
  input: {
    backgroundColor: "#FAFBF9",
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: C.ink,
  },
  button: {
    backgroundColor: C.green,
    borderRadius: 12,
    minHeight: 44,
    paddingVertical: 14,
    paddingHorizontal: 18,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  secondary: { backgroundColor: C.pale },
  buttonText: { fontSize: 14, fontWeight: "700", color: "white" },
  badge: {
    flexDirection: "row",
    gap: 5,
    alignItems: "center",
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 6,
    alignSelf: "flex-start",
  },
  dot: { width: 5, height: 5, borderRadius: 3 },
  empty: {
    alignItems: "center",
    paddingVertical: 28,
    paddingHorizontal: 14,
    gap: 10,
  },
  emptyIcon: {
    borderRadius: 20,
    width: 64,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.pale,
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: C.ink,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 14,
    color: C.muted,
    lineHeight: 22,
    textAlign: "center",
    maxWidth: 310,
  },
  section: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
    gap: 12,
  },
  sectionTitle: { fontSize: 19, fontWeight: "700", color: C.ink },
  caption: { fontSize: 12, color: C.muted, lineHeight: 18 },
  kv: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 20,
    borderBottomWidth: 1,
    borderColor: "#EEF1EC",
    paddingVertical: 10,
  },
  kvValue: {
    flex: 1,
    textAlign: "right",
    fontSize: 13,
    color: C.ink,
    lineHeight: 19,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  h1: { color: C.ink, fontSize: 31, fontWeight: "700", letterSpacing: -1 },
  h2: { color: C.ink, fontSize: 22, fontWeight: "700", letterSpacing: -0.5 },
  body: { color: C.muted, fontSize: 14, lineHeight: 22 },
  link: { color: C.green, fontSize: 13, fontWeight: "700" },
});
