import { useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { getStageWorldTheme, mixHex, stageBaseColor } from './stageThemes';

// Each stage is painted with a single colour, and only its top and bottom edges
// fade. Both neighbours agree on the exact colour at their shared edge, so the
// boundary reads as one gradient instead of two clashing colour masses.
const SEAM_BAND = 0.32;

export default function StageScenery({
  stageIndex,
  top,
  height,
  screenWidth,
  theme,
}: {
  stageIndex: number;
  top: number;
  height: number;
  screenWidth: number;
  theme: 'light' | 'dark';
}) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const night = theme === 'dark';
  const shade = (index: number) => stageBaseColor(getStageWorldTheme(index), night);
  const base = shade(stageIndex);
  // A plain 50/50 mix of the two stage colours. Computed the same way from
  // either side, so stage i ends exactly where stage i+1 begins.
  const enter = mixHex(shade(stageIndex - 1), base, 0.5);
  const exit = mixHex(base, shade(stageIndex + 1), 0.5);
  const skyId = `stage-${id}-flat`;

  return (
    <View pointerEvents="none" style={[styles.scenery, { top, height, width: screenWidth + 36 }]}>
      <Svg
        height={height}
        preserveAspectRatio="none"
        style={StyleSheet.absoluteFill}
        viewBox={`0 0 360 ${Math.max(height, 1)}`}
        width={screenWidth + 36}
      >
        <Defs>
          <LinearGradient id={skyId} x1="0" x2="0" y1="0" y2="1">
            <Stop offset="0" stopColor={enter} />
            <Stop offset={SEAM_BAND} stopColor={base} />
            <Stop offset={1 - SEAM_BAND} stopColor={base} />
            <Stop offset="1" stopColor={exit} />
          </LinearGradient>
        </Defs>
        <Rect width="360" height={height} fill={`url(#${skyId})`} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  scenery: {
    position: 'absolute',
    left: -18,
    overflow: 'hidden',
  },
});
