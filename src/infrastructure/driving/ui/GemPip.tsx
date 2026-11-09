import { styled } from "nativewind";
import { View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

// SVG shapes take colours as props rather than styles, so NativeWind is told to pass fill and stroke classes through as props.
const SVG_COLORS = {
  className: {
    target: false,
    nativeStyleMapping: { fill: true, stroke: true },
  },
} as const;
const StyledCircle = styled(Circle, SVG_COLORS);
const StyledPath = styled(Path, SVG_COLORS);

const TABLE =
  "M16.62 13.91L13.91 16.62L10.09 16.62L7.38 13.91L7.38 10.09L10.09 7.38L13.91 7.38L16.62 10.09Z";
const FACETS =
  "M16.62 13.91L19.07 19.07L13.91 16.62M10.09 16.62L4.93 19.07L7.38 13.91M7.38 10.09L4.93 4.93L10.09 7.38M13.91 7.38L19.07 4.93L16.62 10.09M16.62 13.91L22.5 12L16.62 10.09M13.91 16.62L12 22.5L10.09 16.62M7.38 13.91L1.5 12L7.38 10.09M10.09 7.38L12 1.5L13.91 7.38";

// A filled progress pip: a cut diamond in a gold setting, with a soft glow.
export function GemPip() {
  return (
    <View className="h-3.5 w-3.5 rounded-full shadow-[0_0_3px_rgb(var(--gem-glow)/0.75)]">
      <Svg width="100%" height="100%" viewBox="0 0 24 24">
        <StyledCircle cx={12} cy={12} r={10.5} className="fill-gem-body" />
        <StyledPath d={TABLE} className="fill-gem-table" />
        <StyledPath
          d={FACETS}
          fill="none"
          strokeWidth={0.9}
          strokeLinejoin="round"
          className="stroke-gem-lines"
        />
        <StyledCircle
          cx={12}
          cy={12}
          r={10.5}
          fill="none"
          strokeWidth={0.9}
          className="stroke-gem-lines"
        />
        <StyledCircle cx={9.6} cy={9.6} r={1.3} className="fill-gem-glint" />
        <StyledCircle
          cx={12}
          cy={12}
          r={11}
          fill="none"
          strokeWidth={1.8}
          className="stroke-primary"
        />
      </Svg>
    </View>
  );
}
