import { useTheme } from "@/hooks/use-theme";
import { AccountForm, AccountList } from "@/presentation/components/accounts";
import { MoneyText, LoadingScreen } from "@/presentation/components/common";
import { useAccountsStore } from "@/presentation/stores";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function AccountsScreen() {
  const colors = useTheme();
  const { accounts, isLoading, error, fetchAccounts, createAccount, getTotalBalance } =
    useAccountsStore();
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetchAccounts();
  }, []);

  const totalBalance = getTotalBalance();

  if (isLoading && accounts.length === 0) {
    return <LoadingScreen message="Loading accounts..." />;
  }

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.pageBackground }]}
      edges={["top"]}
    >
      {error && (
        <View style={{ backgroundColor: colors.numberNegative, padding: 8 }}>
          <Text style={{ color: '#fff', fontSize: 12, textAlign: 'center' }}>{error}</Text>
        </View>
      )}
      <View style={[styles.summaryBar, { backgroundColor: colors.primary }]}>
        <Text style={styles.summaryLabel}>Total Budget Balance</Text>
        <MoneyText
          cents={totalBalance}
          colorize={false}
          style={styles.summaryAmount}
        />
      </View>

      {/* Account list */}
      <AccountList
        accounts={accounts}
        refreshing={isLoading}
        onRefresh={fetchAccounts}
        onAddAccount={() => setShowForm(true)}
      />

      {/* FAB */}
      <Pressable
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
        ]}
        onPress={() => setShowForm(true)}
      >
        <Ionicons name="add" size={28} color="#ffffff" />
      </Pressable>

      {/* Add Account Modal */}
      <AccountForm
        visible={showForm}
        onClose={() => setShowForm(false)}
        onSubmit={({ name, offbudget, balance }) => createAccount(name, offbudget, balance)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  summaryBar: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    alignItems: "center",
    gap: 4,
  },
  summaryLabel: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  summaryAmount: { color: "#ffffff", fontSize: 28, fontWeight: "700" },
  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
});
