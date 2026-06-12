import { Href } from "expo-router";
import { Pressable } from "react-native";
import { openBrowserAsync, WebBrowserPresentationStyle } from "expo-web-browser";
import { type ComponentProps } from "react";

type Props = Omit<ComponentProps<typeof Pressable>, "href"> & { href: Href & string };

export function ExternalLink({ href, ...rest }: Props) {
  return (
    <Pressable
      {...rest}
      onPress={async (event: any) => {
        if (process.env.EXPO_OS !== "web") {
          // Prevent the default behavior of linking to the default browser on native.
          event.preventDefault?.();
          // Open the link in an in-app browser.
          await openBrowserAsync(href, {
            presentationStyle: WebBrowserPresentationStyle.AUTOMATIC,
          });
        }
      }}
    />
  );
}
