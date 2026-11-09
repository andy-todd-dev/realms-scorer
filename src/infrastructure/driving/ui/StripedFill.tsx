import { View } from "react-native";

// Enough 12pt pairs of bands to cover the 600pt square below.
const BANDS = Array.from({ length: 50 }, (_, index) => index);

/*
  Diagonal stripes behind a blanked breakdown row, so it reads as void at a glance. A square of bands, rotated and
  centred on the row, covers any row up to about 600pt across its diagonal. Its parent must clip it.
*/
export function StripedFill() {
  return (
    <View pointerEvents="none" className="absolute inset-0">
      <View className="absolute top-1/2 left-1/2 -mt-75 -ml-75 h-150 w-150 -rotate-45">
        {BANDS.map((band) => (
          <View key={band}>
            <View className="h-1.5 bg-stripe" />
            <View className="h-1.5 bg-stripe-alt" />
          </View>
        ))}
      </View>
    </View>
  );
}
