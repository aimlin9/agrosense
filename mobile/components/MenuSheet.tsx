import { Feather } from '@expo/vector-icons';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { colors, fonts, radius, shadows, spacing } from '@/constants/theme';

export interface MenuItem {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  destructive?: boolean;
  onPress: () => void;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  items: MenuItem[];
  /** Position from screen top + right edge, in pixels. */
  anchor: { top: number; right: number };
}

export function MenuSheet({ visible, onClose, items, anchor }: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View
          style={[
            styles.menu,
            { top: anchor.top, right: anchor.right },
          ]}
        >
          {items.map((item, i) => (
            <TouchableOpacity
              key={item.label}
              style={[styles.item, i < items.length - 1 && styles.itemBorder]}
              onPress={() => {
                onClose();
                setTimeout(item.onPress, 120);
              }}
              activeOpacity={0.6}
            >
              <Feather
                name={item.icon}
                size={18}
                color={item.destructive ? colors.severityHigh : colors.textSecondary}
              />
              <Text
                style={[
                  styles.label,
                  item.destructive && { color: colors.severityHigh },
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  menu: {
    position: 'absolute',
    minWidth: 180,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.elevated,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  itemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  label: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
  },
});