import { useTheme } from "@/hooks/use-theme";
import { Button } from "@/presentation/components/common";
import { useAuthStore, useSyncStore, useFileStore } from "@/presentation/stores";
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function SettingsScreen() {
  const colors = useTheme();
  const { user, serverUrl, logout } = useAuthStore();
  const { isSyncing, lastSyncAt, triggerSync } = useSyncStore();
  const { activeFileId, clearActiveFile } = useFileStore();

  const lastSyncLabel = lastSyncAt
    ? new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(lastSyncAt)
    : "Never";

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.pageBackground }]}
      edges={["top"]}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={[styles.screenTitle, { color: colors.textPrimary }]}>
          Settings
        </Text>

        {/* User info */}
        <View
          style={[
            styles.section,
            {
              backgroundColor: colors.cardBackground,
              borderColor: colors.separator,
            },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: colors.textSubdued }]}>
            Account
          </Text>
          <View style={[styles.row, { borderBottomColor: colors.separator }]}>
            <Text style={[styles.rowLabel, { color: colors.textSubdued }]}>
              User
            </Text>
            <Text style={[styles.rowValue, { color: colors.textPrimary }]}>
              {user?.displayName ?? "—"}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: colors.textSubdued }]}>
              Server
            </Text>
            <Text
              style={[styles.rowValue, { color: colors.textPrimary }]}
              numberOfLines={1}
            >
              {serverUrl ?? "—"}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.section,
            {
              backgroundColor: colors.cardBackground,
              borderColor: colors.separator,
            },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: colors.textSubdued }]}>
            Budget
          </Text>
          <View style={[styles.row, { borderBottomColor: colors.separator }]}>
            <Text style={[styles.rowLabel, { color: colors.textSubdued }]}>
              Current File
            </Text>
            <Text style={[styles.rowValue, { color: colors.textPrimary }]}>
              {activeFileId ?? "—"}
            </Text>
          </View>
          <View style={styles.rowAction}>
            <Button variant="secondary" size="sm" onPress={clearActiveFile}>
              Change Budget
            </Button>
          </View>
        </View>

        {/* Sync */}
        <View
          style={[
            styles.section,
            {
              backgroundColor: colors.cardBackground,
              borderColor: colors.separator,
            },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: colors.textSubdued }]}>
            Sync
          </Text>
          <View style={[styles.row, { borderBottomColor: colors.separator }]}>
            <Text style={[styles.rowLabel, { color: colors.textSubdued }]}>
              Last sync
            </Text>
            <Text style={[styles.rowValue, { color: colors.textPrimary }]}>
              {lastSyncLabel}
            </Text>
          </View>
          <View style={styles.rowAction}>
            <Button
              variant="secondary"
              size="sm"
              loading={isSyncing}
              onPress={triggerSync}
            >
              Sync Now
            </Button>
          </View>
        </View>

        {/* Sign out */}
        <View style={styles.signOutSection}>
          <Button variant="danger" size="lg" onPress={logout}>
            Sign Out
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { padding: 16, gap: 16 },
  screenTitle: { fontSize: 28, fontWeight: "700", marginBottom: 8 },
  section: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: { fontSize: 14 },
  rowValue: {
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
    textAlign: "right",
    marginLeft: 16,
  },
  rowAction: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: "flex-start",
  },
  signOutSection: { marginTop: 8 },
});
