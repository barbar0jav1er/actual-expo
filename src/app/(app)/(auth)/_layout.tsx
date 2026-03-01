import { Stack } from "expo-router";
import { useFileStore } from "@/presentation/stores";
import React, { useEffect } from 'react';

export default function AuthLayout() {
  const { activeFileId, checkActiveFile } = useFileStore();

  useEffect(() => {
    checkActiveFile();
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!activeFileId}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="account/[id]" />
        <Stack.Screen name="transaction/[id]" />
        <Stack.Screen name="payees" />
        <Stack.Screen name="payee/[id]" />
      </Stack.Protected>
      <Stack.Protected guard={!activeFileId}>
        <Stack.Screen name="select-file" />
      </Stack.Protected>
    </Stack>
  );
}
