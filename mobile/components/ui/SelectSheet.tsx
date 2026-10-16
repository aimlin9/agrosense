/**
 * Bottom-sheet picker. Replaces Alert-based pickers, which Android caps at
 * three buttons (so 16 regions silently became 3).
 */
import { Feather } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/Text';
import { colors, fonts, radius, spacing } from '@/constants/theme';

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
}

interface Props {
  visible: boolean;
  title: string;
  options: SelectOption[];
  value?: string | null;
  onSelect: (value: string) => void;
  onClose: () => void;
  searchable?: boolean;
}

export function SelectSheet({ visible, title, options, value, onSelect, onClose, searchable }: Props) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);

  const close = () => {
    setQuery('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close} statusBarTranslucent>
      <Pressable style={styles.scrim} onPress={close} accessibilityLabel="Close" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]}>
        <View style={styles.grabber} />
        <View style={styles.header}>
          <Text variant="heading">{title}</Text>
          <Pressable onPress={close} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
            <Feather name="x" size={22} color={colors.inkSoft} />
          </Pressable>
        </View>
        {searchable ? (
          <View style={styles.search}>
            <Feather name="search" size={16} color={colors.inkMuted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search"
              placeholderTextColor={colors.inkFaint}
              style={styles.searchInput}
              autoCorrect={false}
            />
          </View>
        ) : null}
        <FlatList
          data={filtered}
          keyExtractor={(o) => o.value}
          keyboardShouldPersistTaps="handled"
          style={{ maxHeight: 420 }}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          renderItem={({ item }) => {
            const selected = item.value === value;
            return (
              <Pressable
                onPress={() => {
                  onSelect(item.value);
                  close();
                }}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={({ pressed }) => [styles.option, pressed && { backgroundColor: colors.canvas }]}
              >
                <View style={{ flex: 1 }}>
                  <Text variant={selected ? 'bodyStrong' : 'body'} color={selected ? colors.brand : colors.ink}>
                    {item.label}
                  </Text>
                  {item.description ? (
                    <Text variant="caption" color={colors.inkMuted}>
                      {item.description}
                    </Text>
                  ) : null}
                </View>
                {selected ? <Feather name="check" size={18} color={colors.brand} /> : null}
              </Pressable>
            );
          }}
        />
      </View>
    </Modal>
  );
}

/** Field that looks like an input and opens a SelectSheet. */
export function SelectField({
  label,
  value,
  placeholder = 'Choose',
  onPress,
  error,
}: {
  label: string;
  value?: string | null;
  placeholder?: string;
  onPress: () => void;
  error?: string | null;
}) {
  return (
    <View style={{ gap: spacing.xs + 2 }}>
      <Text variant="smallStrong" color={colors.inkSoft} style={{ marginLeft: 2 }}>
        {label}
      </Text>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value || placeholder}`}
        style={({ pressed }) => [
          styles.field,
          { borderColor: error ? colors.danger : colors.hairlineStrong },
          pressed && { backgroundColor: colors.canvas },
        ]}
      >
        <Text variant="body" color={value ? colors.ink : colors.inkFaint} style={{ flex: 1 }} numberOfLines={1}>
          {value || placeholder}
        </Text>
        <Feather name="chevron-down" size={18} color={colors.inkMuted} />
      </Pressable>
      {error ? (
        <Text variant="caption" color={colors.danger} style={{ marginLeft: 2 }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: colors.scrim },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.sm,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.hairlineStrong,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.canvas,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  searchInput: { flex: 1, fontFamily: fonts.regular, fontSize: 15, color: colors.ink, paddingVertical: 10 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.sm,
  },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: colors.hairline },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    minHeight: 54,
    paddingHorizontal: spacing.lg,
  },
});
