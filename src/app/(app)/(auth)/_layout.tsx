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
      </Stack.Protected>
      <Stack.Protected guard={!activeFileId}>
        <Stack.Screen name="select-file" />
      </Stack.Protected>
    </Stack>
  );
}
