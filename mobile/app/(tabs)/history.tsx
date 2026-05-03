import { StyleSheet, Text, View } from 'react-native';

export default function HistoryScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>History</Text>
      <Text style={styles.body}>Camera screen coming next.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, paddingTop: 80, backgroundColor: '#f8fafc' },
  title: { fontSize: 24, fontWeight: '800', color: '#15803d' },
  body: { fontSize: 14, color: '#475569', marginTop: 8 },
});