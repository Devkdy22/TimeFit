import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TimeyCanonicalSvg } from '../../src/components/timey/source/TimeyCanonicalSvg';

const SIZE_OPTIONS = [1024, 2048] as const;

type ExportSize = (typeof SIZE_OPTIONS)[number];

export default function TimeyExportScreen() {
  const [exportSize, setExportSize] = useState<ExportSize>(1024);
  const cells = Array.from({ length: 64 }, (_, idx) => idx);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.controls}>
        <Text style={styles.title}>Timey Export Preview</Text>
        <Text style={styles.subtitle}>canonical SVG reference for 3D generation</Text>
        <View style={styles.row}>
          {SIZE_OPTIONS.map((size) => {
            const active = size === exportSize;
            return (
              <Pressable key={size} onPress={() => setExportSize(size)} style={[styles.chip, active ? styles.chipActive : null]}>
                <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>{size}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.previewShell}>
        <View style={[styles.checkerboard, { width: 320, height: 320 }]}>
          <View style={styles.checkerLayer}>
            {cells.map((idx) => {
              const row = Math.floor(idx / 8);
              const col = idx % 8;
              const dark = (row + col) % 2 === 0;
              return <View key={idx} style={[styles.checkerCell, dark ? styles.checkerDark : styles.checkerLight]} />;
            })}
          </View>
          <View style={styles.exportFrame}>
            <Text style={styles.dimText}>{exportSize}x{exportSize}</Text>
            <TimeyCanonicalSvg state="idle" size={220} />
          </View>
        </View>
        <Text style={styles.note}>white export bg + checkerboard transparency preview</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0B1020' },
  controls: { paddingHorizontal: 16, paddingTop: 16, gap: 8 },
  title: { color: '#F8FAFC', fontSize: 24, fontFamily: 'Pretendard-SemiBold' },
  subtitle: { color: '#94A3B8', fontSize: 12 },
  row: { flexDirection: 'row', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#111827',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipActive: { borderColor: '#58C7C2', backgroundColor: 'rgba(88,199,194,0.2)' },
  chipText: { color: '#94A3B8', fontSize: 12 },
  chipTextActive: { color: '#ECFEFF' },
  previewShell: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  checkerboard: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#F8FAFC',
  },
  checkerLayer: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  checkerCell: {
    width: '12.5%',
    height: '12.5%',
  },
  checkerDark: {
    backgroundColor: '#D9DEE8',
  },
  checkerLight: {
    backgroundColor: '#F6F8FC',
  },
  exportFrame: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  dimText: {
    position: 'absolute',
    top: 10,
    right: 10,
    color: '#475569',
    fontSize: 11,
  },
  note: { color: '#7E8A9C', fontSize: 11 },
});
