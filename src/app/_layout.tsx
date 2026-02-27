import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
  type Theme,
} from "@react-navigation/native";
import { Slot } from "expo-router";
import React from "react";
import { useColorScheme } from "react-native";

import { AnimatedSplashOverlay } from "@/components/animated-icon";
import { Colors } from "@/constants/theme";
import { AppProvider } from "@/presentation/providers";

function buildNavTheme(colorScheme: "light" | "dark"): Theme {
  const base = colorScheme === "dark" ? DarkTheme : DefaultTheme;
  const colors = Colors[colorScheme];
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.primary,
      background: colors.pageBackground,
      card: colors.cardBackground,
      border: colors.separator,
      text: colors.textPrimary,
    },
  };
}

export default function RootLayout() {
  const scheme = useColorScheme();
  const colorScheme = scheme === "dark" ? "dark" : "light";
  const navTheme = buildNavTheme(colorScheme);

  return (
    <ThemeProvider value={navTheme}>
      <AnimatedSplashOverlay />
      <AppProvider>
        <Slot />
      </AppProvider>
    </ThemeProvider>
  );
}
